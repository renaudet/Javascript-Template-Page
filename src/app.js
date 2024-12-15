const TemplateEngine = require('./app_modules/templateEngine');

const TEMPLATE_PATH = '/node/nodeModuleTemplate.jtp';
const WORKING_DIRECTORY = '../workDir';

let TEMPLATE_CONFIG = {
	"templateRepository": __dirname+"/"+WORKING_DIRECTORY+"/repository",
	"workDir": __dirname+"/"+WORKING_DIRECTORY+"/gen",
	"logging": {
		"level": "trace"
	}
}

let engine = new TemplateEngine(TEMPLATE_CONFIG);
let compilationContext = engine.preCompile(TEMPLATE_PATH);
console.log(JSON.stringify(compilationContext,null,'\t'));
if('SUCCESS'==compilationContext._status){
	let generationContext = {
		"_owner": "Nicolas Renaudet",
		"_targetFilename": "myModule",
		"someProperty": "Hello, World!"
	};
	engine.process(TEMPLATE_PATH,generationContext);
	console.log('Total processing time: '+generationContext._endTime.diff(generationContext._beginTime)+'msec.');
	//console.log(JSON.stringify(generationContext,null,'\t'));
}