/*
 * loggingUtils.js - a simple logger interface to decouple logging function implementations from calling classes
 * Copyright 2024 Nicolas Renaudet - All rights reserved
 */
const moment = require('moment');
const TIMESTAMP_FORMAT = 'YYYY/MM/DD HH:mm:ss';
const LOG_LEVEL_ERROR = 0;
const LOG_LEVEL_WARNING = 1;
const LOG_LEVEL_INFO = 2;
const LOG_LEVEL_DEBUG = 3;
const LOG_LEVEL_TRACE = 4;
const LEVEL_MAP = {
	"error": LOG_LEVEL_ERROR,
	"warning": LOG_LEVEL_WARNING, 
	"info": LOG_LEVEL_INFO, 
	"debug": LOG_LEVEL_DEBUG, 
	"trace": LOG_LEVEL_TRACE
}

class Logger{
	currentTraceLevel = LOG_LEVEL_INFO;
	constructor(config={}){
		if(config && config.level){
			this.currentTraceLevel = LEVEL_MAP[config.level];
		}
		this.info(this.constructor.name+': trace level set to '+this.currentTraceLevel);
	}
	formatTraceMsg(level,txt){
		return moment().format(TIMESTAMP_FORMAT)+' '+level+' '+txt;
	}
	log(txt){
		console.log(txt);
	}
	info(txt){
		if(this.currentTraceLevel>=LOG_LEVEL_INFO){
			this.log(this.formatTraceMsg('I',txt));
		}
	}
	trace(txt){
		if(this.currentTraceLevel>=LOG_LEVEL_TRACE){
			this.log(this.formatTraceMsg('F',txt));
		}
	}
	debug(txt){
		if(this.currentTraceLevel>=LOG_LEVEL_DEBUG){
			this.log(this.formatTraceMsg('D',txt));
		}
	}
	error(txt){
		if(this.currentTraceLevel>=LOG_LEVEL_ERROR){
			this.log(this.formatTraceMsg('E',txt));
		}
	}
	warning(txt){
		if(this.currentTraceLevel>=LOG_LEVEL_WARNING){
			this.log(this.formatTraceMsg('W',txt));
		}
	}
}

module.exports = Logger;