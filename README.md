# Javascript-Template-Page
A template-based generator that uses the classic JSP scriptlet syntax for javascript
## Usage
Import the Template Page runtime

```javascript
const TemplateEngine = require('./app_modules/templateEngine');
```

Provide the engine configuration as a JSON file

```javascript
const TEMPLATE_PATH = '/node/nodeModuleTemplate.jtp';
const WORKING_DIRECTORY = '../workDir';

let TEMPLATE_CONFIG = {
	"templateRepository": __dirname+"/"+WORKING_DIRECTORY+"/repository",
	"workDir": __dirname+"/"+WORKING_DIRECTORY+"/gen",
	"logging": {
		"level": "trace"
	}
} 
```

Invoke the engine to process the template given the processing context:

```javascript
let generationContext = {
	"_owner": "Nicolas Renaudet",
	"_targetFilename": "myModule",
	"someProperty": "Hello, World!"
};
engine.process(TEMPLATE_PATH,generationContext);
```

Check the context for the generation status:

```javascript
if('SUCCESS'==generationContext._status){
	console.log('Total processing time: '+generationContext._endTime.diff(generationContext._beginTime)+'msec.');
}
```

## Template syntax

A template is a simple text file augmented with JTP tags or scriptlets

```text
<jtp:template type="text" extension="txt"/>
Hello, World!
```

### scriptlets

Scriptlets lets you insert content using pure javascript code:

```text
<jtp:template type="text" extension="txt"/>
some text
<% out.print(executionContext.someProperty);  %>
some other text
```

Given our previous generation context, this template will produce the following output:

```text

some text
Hello, World!
some other text
```

Notice the first line break. It appears because of the line break immediately following the `<jtp:template/>` tag.
To prevent this behavior, one must remember to remove those unwanted line-breaks from the template:

```text
<jtp:template type="text" extension="txt"/>some text
<% out.print(executionContext.someProperty);  %>
some other text
```

### template tags

Tags provide a simple, standard way to generate content based on the generation context without relying on scriptlets.
It is a best practice to use tags instead of scriptlets where possible as the generated content will benefit bug fixes and possible optimizations whereas scriplets are hard-coded, runtime-dependent behavior.

#### getProperty tag

The `<jtp:getProperty/>` tag will insert a generation context property value given its name:


```text
<jtp:template type="text" extension="txt"/><jtp:getProperty name="someProperty"/>
```

This will produce:

```text
Hello, World!
```

#### property tag

The `<jtp:property/>` tag declares a required context property for this template. It is especially usefull when the template
is used in interactive mode by using the template engine `preCompile()`method.

The following template declares a property and gives hints for its usage:

```text
<jtp:template type="text" extension="txt"/><jtp:property name="someProperty" type="string" default="someValue"/>
<jtp:getProperty name="someProperty"/>
```