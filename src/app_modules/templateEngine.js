/*
 * templateEngine.js - Template Engine - provide the JTP runtime
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */

const moment = require('moment');
const Workspace = require('./workspace');
const Logger = require('./loggingUtil');
const TOKEN_TYPE_TEXT = 0;
const TOKEN_TYPE_TAG = 1;
const TOKEN_TYPE_SCRIPTLET = 2;
const TYPE_TO_STRING = ['Text','Tag','scriptlet'];
const TIMESTAMP_FORMAT = 'YYYY/MM/DD HH:mm:ss';
const STATUS_PENDING = 'PENDING';
const STATUS_SUCCESS = 'SUCCESS';
const STATUS_ERROR = 'ERROR';
var _DEBUG = false;

class TagTokenHandler{
	name = null;
	properties = {};
	engine = null;
	constructor(tagToken,engine){
		this.engine = engine;
		let tagExpr = tagToken.getContent().substring(5,tagToken.length-2).replace(/" /g,'"|');
		let firstSpaceIndex = tagExpr.indexOf(' ');
		if(firstSpaceIndex>0){
			this.name = tagExpr.substring(0,firstSpaceIndex);
		}
		let lemes = tagExpr.substring(firstSpaceIndex+1).split('|');
		for(var i=0;i<lemes.length;i++){
			let lemme = lemes[i].split('=');
			try{
				let propId = lemme[0];
				let propValue = lemme[1].replace(/"/g,'');
				this.properties[propId] = propValue;
			}catch(exception){}
		}
	}
	getProperty(name,context){
		let value = this.properties[name];
		if(typeof value!='undefined'){
			if(value.startsWith('$')){
				let varName = value.replace(/$/g,'');
				value = context[varName];
			}
		}
		return value;
	}
	contribute(context){
		if(_DEBUG) console.log('Tag token handler "'+this.name+'" contributing...');
		if('template'==this.name){
			context._output = '';
			let type = this.getProperty('type',context);
			if(typeof type=='undefined'){
				type = 'text';
			}
			if('text'==type){
				let extension = this.getProperty('extension',context);
				if(typeof extension=='undefined'){
					extension = 'txt';
				}
				if(context._targetFilename){
					let suffixe = '.'+extension;
					if(!context._targetFilename.endsWith(suffixe)){
						context._targetFilename = context._targetFilename+suffixe;
					}
				}
			}
			
			if('set'==type){
				let baseDir = this.getProperty('baseDir',context);
				if(typeof baseDir=='undefined' || baseDir=='/' || baseDir=='./'){
					baseDir = '';
				}
				context._workingDirectory = context._workingDirectory+baseDir.replace(/\.\//g,'/');
				if(_DEBUG) console.log('Working directory is now '+context._workingDirectory);
			}
		}
		if('call'==this.name){
			let templateName = this.getProperty('template',context);
			let targetFilename = this.getProperty('targetFilename',context);
			let targetFolder = this.getProperty('targetFolder',context);
			
			// call the templateEngine here
			var subContext = Object.assign({},context);
			subContext._targetFolder = targetFolder.replace(/\.\//g,'/');
			subContext._targetFilename = targetFilename;
			
			if(_DEBUG) console.log(JSON.stringify(subContext,null,'\t'));
			
			let templateRelativePath = context._workingDirectory+'/'+templateName;
			try{
				this.engine.process(templateRelativePath,subContext);
				if(_DEBUG) console.log('after TemplateEngine process()...');
				if(_DEBUG) console.log(JSON.stringify(subContext,null,'\t'));
				if(subContext._status!=STATUS_SUCCESS){
					context._status = STATUS_ERROR;
					context._output += 'Sub-template generation failed for template '+templateName+'\n';
					context._output += JSON.stringify(subContext._details);
					context._output += '\n';
					if(_DEBUG) console.log('generation failed...');
					if(_DEBUG) console.log(JSON.stringify(context,null,'\t'));
				}
			}catch(exception){
				if(_DEBUG) console.log(exception);
				context._status = STATUS_ERROR;
				context._output += 'Sub-template generation failed for template'+templateName+' due to uncaught exception\n';
				//context._output += exception.message;
				context._output += '\n';
			}
			return '';
		}
		if('getProperty'==this.name){
			let propertyName = this.getProperty('name',context);
			if(_DEBUG) console.log('- looking for property '+propertyName+' in context');
			if(propertyName && typeof context[propertyName]!='undefined'){
				return '    out.print(executionContext[\''+propertyName+'\']);\n';
			}
		}
		if('property'==this.name){
			let propertyName = this.getProperty('name',context);
			let propertyDefaultValue = this.getProperty('default',context);
			let propertyType = this.getProperty('type',context);
			if(_DEBUG) console.log('- looking for property '+propertyName);
			if(propertyName && typeof context[propertyName]=='undefined' && typeof propertyDefaultValue!='undefined'){
				if(typeof propertyType!='undefined'){
					if('string'==propertyType || 'String'==propertyType || 'text'==propertyType){
						context[propertyName] = propertyDefaultValue;
					}
					if('int'==propertyType || 'integer'==propertyType || 'Integer'==propertyType || 'numeric'==propertyType){
						context[propertyName] = parseInt(propertyDefaultValue);
					}
					if('boolean'==propertyType || 'Boolean'==propertyType){
						context[propertyName] = (propertyDefaultValue=='true' || propertyDefaultValue=='TRUE' || propertyDefaultValue=='yes' || propertyDefaultValue=='1');
					}
					if('array'==propertyType || 'Array'==propertyType){
						context[propertyName] = propertyDefaultValue.split(',');
					}
				}else{
					//assume String
					context[propertyName] = propertyDefaultValue;
				}
			}
		}
		if('useBean'==this.name){
			let beanId = this.getProperty('id',context);
			let beanClass = this.getProperty('class',context);
			if(_DEBUG) console.log('useBean Tag token handler - looking for bean ID#'+beanId+' in context');
			if(beanId && typeof context[beanId]=='undefined' && beanClass){
				if(_DEBUG) console.log('not found!');
				context[beanId] = eval('new context.' + beanClass + '()');
			}
		}
		if('getBeanProperty'==this.name){
			let beanId = this.getProperty('bean',context);
			let propertyName = this.getProperty('name',context);
			if(_DEBUG) console.log('getBeanProperty Tag token handler - looking for a bean ID#'+beanId);
			if(beanId && typeof context[beanId]!='undefined' && propertyName){
				return '    out.print(executionContext[\''+beanId+'\'][\''+propertyName+'\']);\n';
			}
		}
		return '';
	}
}

class TextTokenHandler{
	token = null;
	constructor(textToken,engine){
		this.token = textToken;
	}
	contribute(context){
		//return this.token.getContent();
		let begin = this.token.pos;
		let end = this.token.pos+this.token.length;
		return '    out.print(this.buffer.substring('+begin+','+end+'));\n';
	}
}

class ScriptletTokenHandler{
	token = null;
	constructor(textToken,engine){
		this.token = textToken;
	}
	contribute(context){
		let content = this.token.getContent();
		let src = content.substring(2,content.length-2);
		if(src){
			if(src && src.startsWith('=')){
				return '    out.print('+src.substring(1)+');\n';
			}else{
				return src+'\n';
			}
		}
	}
}
 
class Template {
	internalBuffer = null;
	generationHandlers = [];
	contextHandlers = [];
	engine = null;
	templatelet = null;
	constructor(templateSource,templateEngine){
		this.internalBuffer = templateSource;
		this.engine = templateEngine;
	}
	initialize(tokenList){
		for(var i=0;i<tokenList.length;i++){
			let token = tokenList[i];
			if(TOKEN_TYPE_TEXT==token.type){
				this.generationHandlers.push(new TextTokenHandler(token,this.engine));
			}
			if(TOKEN_TYPE_TAG==token.type){
				let tagHandler = new TagTokenHandler(token,this.engine);
				if('getProperty'==tagHandler.name){
					this.generationHandlers.push(tagHandler);
				}
				if('getBeanProperty'==tagHandler.name){
					this.generationHandlers.push(tagHandler);
				}
				if('template'==tagHandler.name){
					this.contextHandlers.push(tagHandler);
				}
				if('property'==tagHandler.name){
					this.contextHandlers.push(tagHandler);
				}
				if('useBean'==tagHandler.name){
					this.contextHandlers.push(tagHandler);
				}
				if('call'==tagHandler.name){
					this.generationHandlers.push(tagHandler);
				}
			}
			if(TOKEN_TYPE_SCRIPTLET==token.type){
				this.generationHandlers.push(new ScriptletTokenHandler(token,this.engine));
			}
		}
	}
	process(generationContext){
		for(var i=0;i<this.contextHandlers.length;i++){
			let handler = this.contextHandlers[i];
			handler.contribute(generationContext);
		}
		if(_DEBUG) console.log('in Template#process() - after context handler contributions');
		if(_DEBUG) console.log(JSON.stringify(generationContext,null,'\t'));
		if(generationContext._status != STATUS_ERROR){
			if(this.templatelet==null){
				let internalTemplateSourceCode = '';
				internalTemplateSourceCode += '{\n';
				internalTemplateSourceCode += '  "buffer": null,\n';
				internalTemplateSourceCode += '  process(ctx){\n';
				internalTemplateSourceCode += '    let printWriter = {\n';
				internalTemplateSourceCode += '       "output": "",\n';
				internalTemplateSourceCode += '       print(text){\n';
				internalTemplateSourceCode += '          this.output += text;\n';
				internalTemplateSourceCode += '       }\n';
				internalTemplateSourceCode += '    }\n';
				internalTemplateSourceCode += '    this.internalProcess(printWriter,ctx);\n';
				internalTemplateSourceCode += '    return printWriter.output;\n';
				internalTemplateSourceCode += '  },\n';
				internalTemplateSourceCode += '  internalProcess(out,executionContext){\n';
				for(var i=0;i<this.generationHandlers.length;i++){
					let handler = this.generationHandlers[i];
					internalTemplateSourceCode += handler.contribute(generationContext);
				}
				if(_DEBUG) console.log('in Template#process() - after generation handler contributions');
				if(_DEBUG) console.log(JSON.stringify(generationContext,null,'\t'));
				
				internalTemplateSourceCode += '  }\n}';
				if(_DEBUG) console.log('--- internalTemplateSourceCode BEGIN ---');
				if(_DEBUG) console.log(internalTemplateSourceCode);
				if(_DEBUG) console.log('--- internalTemplateSourceCode END ---');
				if(generationContext._status != STATUS_ERROR){
					try{
						let templatelet = null;
						eval('templatelet = '+internalTemplateSourceCode);
						this.templatelet = templatelet; 
						this.templatelet.buffer = this.internalBuffer;
						try{
							let out = this.templatelet.process(generationContext);
							generationContext._status = STATUS_SUCCESS;
							return out;
						}catch(Exception){
							generationContext._status = STATUS_ERROR;
							generationContext._details = evalException;
							return '';
						}
					}catch(evalException){
						generationContext._status = STATUS_ERROR;
						generationContext._details = evalException;
						if(_DEBUG) console.log(evalException);
						return '';
					}
				}else{
					return '';
				}
			}else{
				try{
					let out = this.templatelet.process(generationContext);
					generationContext._status = STATUS_SUCCESS;
					return out;
				}catch(Exception){
					if(_DEBUG) console.log(Exception);
					generationContext._status = STATUS_ERROR;
					generationContext._details = Exception;
					return '';
				}
			}
		}else{
			return '';
		}
	}
}

class Token{
	pos = 0;
	length = 0;
	buffer = null;
	type = TOKEN_TYPE_TEXT;
	constructor(type,startingIndex,length,buffer){
		this.type = type;
		this.pos = startingIndex;
		this.length = length;
		this.buffer = buffer;
	}
	getContent(){
		return this.buffer.substring(this.pos,this.pos+this.length);
	}
	toString(){
		let type = TYPE_TO_STRING[this.type];
		return '['+this.pos+','+this.length+'] '+type+' '+this.getContent().replace(/\n/g,'\\n').replace(/\r/g,'\\r');
	}
}
 
class TemplateParser {
	source = null;
	engine = null;
	constructor(engine,templateSource){
		this.engine = engine;
		this.source = templateSource;
	}
	parse(){
		if(_DEBUG) console.log('--- BEGIN PARSER REPORT ---');
		let template = new Template(this.source,this.engine);
		
		let tokens = this.tokenize();
		for(var i=0;i<tokens.length;i++){
			let token = tokens[i];
			if(_DEBUG) console.log(token.toString());
		}
		
		template.initialize(tokens);
		if(_DEBUG) console.log('--- END PARSER REPORT ---');
		return template;
	}
	tokenize(){
		if(_DEBUG) console.log('--- BEGIN TOKENIZER REPORT ---');
		let tokens = [];
		
		let tokenBuffer = null;
		let currentToken = null;
		let lineNumber = 1;
		let tokenStartIndex = 0;
		for(var i=0;i<this.source.length;i++){
			let currentChar = this.source.charAt(i);
			if(tokenBuffer==null){
				tokenBuffer = '';
				tokenStartIndex = i;
			}
			tokenBuffer += currentChar;
			if(currentToken!=null && TOKEN_TYPE_TAG==currentToken.type && tokenBuffer.endsWith('/>')){
				if(_DEBUG) console.log('-Line '+lineNumber+' position '+i+': Tag token end detected');
				currentToken.length = tokenBuffer.length;
				tokens.push(currentToken);
				tokenBuffer = null;
				currentToken = null;
			}
			if(currentToken!=null && TOKEN_TYPE_SCRIPTLET==currentToken.type && tokenBuffer.endsWith('%>')){
				if(_DEBUG) console.log('-Line '+lineNumber+' position '+i+': Scriptlet token end detected');
				currentToken.length = tokenBuffer.length;
				tokens.push(currentToken);
				tokenBuffer = null;
				currentToken = null;
			}
			if(tokenBuffer!=null && currentToken==null && tokenBuffer.length>2 && tokenBuffer.endsWith('<%')){
				if(_DEBUG) console.log('-Line '+lineNumber+' position '+i+': Text token end detected');
				currentToken = new Token(TOKEN_TYPE_TEXT,tokenStartIndex,tokenBuffer.length-2,this.source);
				tokens.push(currentToken);
				tokenStartIndex = i-1;
				tokenBuffer = '<%';
				currentToken = null;
			}
			if(tokenBuffer!=null && currentToken==null && tokenBuffer.length>5 && tokenBuffer.endsWith('<jtp:')){
				if(_DEBUG) console.log('-Line '+lineNumber+' position '+i+': Text token end detected');
				currentToken = new Token(TOKEN_TYPE_TEXT,tokenStartIndex,tokenBuffer.length-5,this.source);
				tokens.push(currentToken);
				tokenStartIndex = i-4;
				tokenBuffer = '<jtp:';
				currentToken = null;
			}
			if(tokenBuffer!=null && '<jtp:'==tokenBuffer){
				if(_DEBUG) console.log('-Line '+lineNumber+' position '+i+': Tag token start detected');
				currentToken = new Token(TOKEN_TYPE_TAG,tokenStartIndex,5,this.source);
			}
			if(tokenBuffer!=null && '<%'==tokenBuffer){
				if(_DEBUG) console.log('-Line '+lineNumber+' position '+i+': Scriptlet token start detected');
				currentToken = new Token(TOKEN_TYPE_SCRIPTLET,tokenStartIndex,2,this.source);
			}
			if(tokenBuffer!=null && currentToken!=null){
				currentToken.length = tokenBuffer.length;
			}
			if('\n'==currentChar){
				lineNumber++;
			}
		}
		if(currentToken==null && tokenBuffer!=null && tokenBuffer.length>0){
			if(_DEBUG) console.log('-Line '+lineNumber+' position '+i+': Last remaining Text token end detected');
			currentToken = new Token(TOKEN_TYPE_TEXT,tokenStartIndex,tokenBuffer.length,this.source);
			tokens.push(currentToken);
		}
		if(_DEBUG) console.log('--- END TOKENIZER REPORT ---');
		return tokens;
	}
}

class TemplateEngine extends Logger{
	cache = {};
	templateWorkspace = null;
	generationWorkspace = null;
	configuration = null;
	constructor(options){
		super(options.logging);
		this.configuration = options;
		this.trace('template engine configuration:\n'+JSON.stringify(this.configuration,null,'\t'));
	}
	getWorkspace(){
		this.debug('->TemplateEngine#getWorkspace()');
		if(this.templateWorkspace==null){
			this.debug('creating new Template Repository Workspace with root: '+this.configuration.templateRepository);
			this.templateWorkspace = new Workspace({"root": this.configuration.templateRepository,"logging": this.configuration.logging});
		}
		this.debug('<-TemplateEngine#getWorkspace()');
		return this.templateWorkspace;
	}
	getWorkingDirectory(){
		this.debug('->TemplateEngine#getWorkingDirectory()');
		if(this.generationWorkspace==null){
			this.debug('creating new Workspace with root: '+this.configuration.workDir);
			this.generationWorkspace = new Workspace({"root": this.configuration.workDir,"logging": this.configuration.logging});
		}
		this.debug('<-TemplateEngine#getWorkingDirectory()');
		return this.generationWorkspace;
	}
	preCompile(templateRelativePath){
		this.debug('->TemplateEngine#preCompile()');
		this.debug('template relative path: '+templateRelativePath);
		let compilationContext = {};
		compilationContext._status = STATUS_PENDING;
		compilationContext._beginTime = moment();
		compilationContext._begin = compilationContext._beginTime.format(TIMESTAMP_FORMAT);
		try{
			let templateInfo = this.getWorkspace().getFileInfo(templateRelativePath);
			this.debug('Template file stats:');
			this.debug(JSON.stringify(templateInfo));
			let template = null;
			let lastModified = moment(templateInfo.mtime);
			//lookup template in cache
			let cachedTemplateData = this.cache[templateInfo.ino];
			if(typeof cachedTemplateData!='undefined' && cachedTemplateData.compiled){
				if(lastModified.isBefore(cachedTemplateData.compiled)){
					template = cachedTemplateData.template;
					this.debug('using cached template with timestamp: '+cachedTemplateData.compiled.format(TIMESTAMP_FORMAT));
				}else{
					this.debug('outdated cached template detected! cleaning...');
					delete this.cache[templateInfo.ino];
				}
			}
			compilationContext._workingDirectory = templateRelativePath.substring(0,templateRelativePath.lastIndexOf('/'));
			this.debug('Working directory set to: '+compilationContext._workingDirectory);
			
			if(template==null){
				this.debug('template compilation from source needed!');
				let templateSource = this.getWorkspace().getFileContent(templateRelativePath);
				this.debug('--- template "'+templateRelativePath+'"\n'+templateSource);
				this.debug('---');
				
				let parser = new TemplateParser(this,templateSource);
				template = parser.parse();
				
				// no exception -> put in cache
				cachedTemplateData = {"compiled": moment(),"template": template};
				this.cache[templateInfo.ino] = cachedTemplateData;
			}
			
			compilationContext._handlers = [];
			for(var i=0;i<template.contextHandlers.length;i++){
				let tagHandler = template.contextHandlers[i];
				let clone = Object.assign({},tagHandler);
				delete clone.engine;
				compilationContext._handlers.push(clone);
			}
			compilationContext._status = STATUS_SUCCESS;
		}catch(exception){
			this.info('Exception caught processing template '+templateRelativePath);
			compilationContext._status = STATUS_ERROR;
			compilationContext._details = exception;
		}
		compilationContext._endTime = moment();
		compilationContext._end = compilationContext._endTime.format(TIMESTAMP_FORMAT);
		this.debug('<-TemplateEngine#preCompile()');
		return compilationContext;
	}
	process(templateRelativePath,generationContext){
		this.debug('->TemplateEngine#process()');
		this.debug('template relative path: '+templateRelativePath);
		this.debug('generation context: '+JSON.stringify(generationContext));
		generationContext._status = STATUS_PENDING;
		generationContext._beginTime = moment();
		generationContext._begin = generationContext._beginTime.format(TIMESTAMP_FORMAT);
		if(typeof generationContext._owner=='undefined'){
			generationContext._owner = 'anonymous';
		}
		
		try{
			let templateInfo = this.getWorkspace().getFileInfo(templateRelativePath);
			this.debug('Template file stats:');
			this.debug(JSON.stringify(templateInfo));
			let template = null;
			let lastModified = moment(templateInfo.mtime);
			//lookup template in cache
			let cachedTemplateData = this.cache[templateInfo.ino];
			if(typeof cachedTemplateData!='undefined' && cachedTemplateData.compiled){
				if(lastModified.isBefore(cachedTemplateData.compiled)){
					template = cachedTemplateData.template;
					this.debug('using cached template with timestamp: '+cachedTemplateData.compiled.format(TIMESTAMP_FORMAT));
				}else{
					this.debug('outdated cached template detected! cleaning...');
					delete this.cache[templateInfo.ino];
				}
			}
			generationContext._workingDirectory = templateRelativePath.substring(0,templateRelativePath.lastIndexOf('/'));
			this.debug('Working directory set to: '+generationContext._workingDirectory);
			
			if(template==null){
				this.debug('template compilation from source needed!');
				let templateSource = this.getWorkspace().getFileContent(templateRelativePath);
				this.debug('--- template "'+templateRelativePath+'"\n'+templateSource);
				this.debug('---');
				
				let parser = new TemplateParser(this,templateSource);
				template = parser.parse();
				
				// no exception -> put in cache
				cachedTemplateData = {"compiled": moment(),"template": template};
				this.cache[templateInfo.ino] = cachedTemplateData;
			}
			
			let output = template.process(generationContext);
			if(generationContext._status==STATUS_SUCCESS){
				if(generationContext._targetFilename){
					this.getWorkingDirectory().setFileContent(generationContext._targetFilename,output);
				}else{
					generationContext._output = output;
				}
			}
		}catch(exception){
			this.info('Exception caught processing template '+templateRelativePath);
			generationContext._status = STATUS_ERROR;
			generationContext._details = exception;
		}
		generationContext._endTime = moment();
		generationContext._end = generationContext._endTime.format(TIMESTAMP_FORMAT);
		this.debug('<-TemplateEngine#process()');
	}
}

module.exports = TemplateEngine;