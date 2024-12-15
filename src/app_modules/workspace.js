/*
 * workspace.js - an workspace support module
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
const Logger = require('./loggingUtil');
const fs = require('fs'); 

class Workspace extends Logger{
	configuration = null;
	constructor(options={}){
		super(options.logging);
		this.configuration = options;
	}
	getAbsoluteFilePath(relativPath){
		this.debug('->Workspace#getAbsoluteFilePath()');
		this.trace('relativPath: '+relativPath);
		this.debug('<-Workspace#getAbsoluteFilePath()');
		return this.configuration.root+(relativPath.startsWith('/')?relativPath:'/'+relativPath);
	}
	getFileInfo(filePath){
		this.debug('->Workspace#getFileInfo()');
		this.trace('filePath: '+filePath);
		var stat = fs.statSync(this.getAbsoluteFilePath(filePath));
		this.debug('<-Workspace#getFileInfo()');
		return stat;
	}
	getFileContent(filePath){
		this.debug('->Workspace#getFileContent()');
		this.trace('filePath: '+filePath);
		var buffer = fs.readFileSync(this.getAbsoluteFilePath(filePath));
		this.debug('<-Workspace#getFileContent()');
		return buffer.toString();
	}
	setFileContent(workspaceRelativeFileName,content){
		this.debug('->Workspace#setFileContent()');
		this.trace('workspaceRelativeFileName: '+workspaceRelativeFileName);
		let absolutePath = this.getAbsoluteFilePath(workspaceRelativeFileName);
		this.trace('absolutePath: '+absolutePath);
		let folder = absolutePath.substring(0,absolutePath.lastIndexOf('/'));
		this.trace('folder: '+folder);
		fs.mkdirSync(folder,{"recursive": true});
		var stream = fs.createWriteStream(absolutePath, {flags:'w'});
		let workspace = this;
		stream.on('error', function (err) {
			workspace.error('in Workspace#setFileContent()');
			workspace.error(JSON.stringify(err));
		});
		if(this.configuration.encoding){
			stream.write(content,this.configuration.encoding);
		}else{
			stream.write(content);
		}
		stream.end();
		this.debug('<-Workspace#setFileContent()');
	}
}

module.exports = Workspace;