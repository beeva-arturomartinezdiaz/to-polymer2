const path = require('path');
const fs = require('fs');
const Handlebars = require('handlebars');
const beautify = require('js-beautify').js_beautify;

const patterns = {
    behaviors   : /behaviors\:[\n\r\s]+\[[\n\r\s]+([\w\,\s]+)\](\,|\n)/,
    properties  : /properties\:\s{1,}\{([\s\/\*\w\@\{\}\:\'\_\,\(\)\[\]\;]+)\}{1}(\,|\n)/,
    observers   : /observers\:\s*\[([\w\s\'\_\(\)\.\,]+)\]/,
    methods     : /([\/\*\@\_\w\s\<\>\.]+)\:\s*function\s*(\(.*\))\s*\{([\w\W]+)\}(\,|\n)/g,
    listeners   : /listeners:\s\{\s+(\'[\w\W]+\'\:\s\'[\w\W]+\'[\s]+)\}(\,|\n)/,
    ready       : /ready\s+\(.*\)\s+\{([\s\/\w\.\(\'\,\)\;\-\+\_\[\]]+)\}/

};

function capitalize(text = '')
{
    return `${text.charAt(0).toUpperCase()}${text.substr(1)}`;
}

function camelize(text = '')
{
    return text.split('-').map((part, index) => {
        return !!index
            ? capitalize(part)
            : part;
    }).join('.').replace(/\./g, '');
}

function isAPolymerComponent(root = '', name = '')
{
    let result = fs.existsSync(path.resolve(root, `bower.json`));
    if (result)
    {
        result = fs.existsSync(path.resolve(root, `${name}.html`));
    }
    return result;
}

function _hasSegment(segment = '', content = '')
{
    let exp = new RegExp(segment, 'g');
    return exp.test(content);
}

function _extractSegment(segment = '', content = '')
{
    return content.match(patterns[segment]);
}

function _extractBehaviors(content = '')
{
    let behaviors = _extractSegment('behaviors', content);
    if (Array.isArray(behaviors) && typeof behaviors[1] !== 'undefined') {
        behaviors = behaviors[1].split(',').map((behavior, index) => {
            behavior = behavior.trim();
            return !!index
                ? `, ${behavior}`
                : behavior;
        });
    }
    return behaviors;
}

function _extractProperties(content = '')
{
    let properties = _extractSegment('properties', content);
    properties = Array.isArray(properties) ? typeof properties[1] !== 'undefined' ? properties[1] : null : null;
    if (properties) {
        properties = properties.replace(/\:\sfunction\(\)/g, '() ');
    }
    return properties;
}

function _extractObservers(content = '')
{
    let observers = _extractSegment('observers', content);
    if (Array.isArray(observers))
    {
        observers = observers.shift().replace(/observers\:\s*\[/, '').replace(']', '').trim();
    }
    return observers;
}

function _extractMethods(content = '')
{
    let methods = content.match(patterns.methods);
    if (Array.isArray(methods)) {
        methods = methods.map(method => {
            method = method.trim();
            method = method.match(/([\w\W]+)\:\s*function\s*([\w\W]+)$/);
            if (Array.isArray(method) && method.length === 3)
            {
                let prev = method[1];
                let next = method[2];
                if (!/value/.test(prev))
                {
                    method = `${prev}${next}`.replace(/\:\s*function/g, '').replace(/\}\,$/g, '}');
                }
                else
                {
                    method = null;
                }
            }
            return method;
        }).join('\n');
    }
    return methods.replace(/\}\,\n/g, '}');
}

function _extractListeners(content = '')
{
    let listeners = content.match(patterns.listeners);
    listeners = Array.isArray(listeners) ? listeners.shift() : null;
    if (typeof listeners === 'string')
    {
        listeners = listeners.replace(/listeners\:\s*\{/, '').trim().split(',');
        listeners = listeners.map(listener => {
            if (listener !== '')
            {
                listener = listener.replace(/[\{\}]+/g, '');
                listener = listener.trim();
                listener = listener.split(':');
                let source = 'this';
                let event = listener[0].trim();
                let callback = listener[1].trim();
                if (event.lastIndexOf('.') !== -1)
                {
                    source = `this.$[${listener[0].split('.')[0].trim()}']`;
                    event = `'${listener[0].split('.')[1].trim()}`;
                }
                return `${source}.addEventListener(${event}, this[${callback}].bind(this));`;
            }
            return listener;
        }).join('\n');
    }
    return listeners;
}

function jsReplace(root = '', name = '', output = '')
{
    let jsFile = path.resolve(root, `${name}.js`);
    let isSingleJSFile = fs.existsSync(jsFile);
    let source = isSingleJSFile
        ? jsFile
        : path.resolve(root, `${name}.html`);

    let sourceContent = fs.readFileSync(source, 'utf-8').toString();
    output = output !== ''
        ? path.resolve(output, `${name}.js`)
        : source;

    let behaviors = _hasSegment('behaviors', sourceContent)
        ? _extractBehaviors(sourceContent)
        : undefined;

    let properties = _hasSegment('properties', sourceContent)
        ? _extractProperties(sourceContent)
        : undefined;

    let observers = _hasSegment('observers', sourceContent)
        ? _extractObservers(sourceContent)
        : undefined;

    let methods = _extractMethods(sourceContent);

    let listeners = _hasSegment('listeners', sourceContent)
        ? _extractListeners(sourceContent)
        : undefined;


    let hasReady = methods.match(/ready/g);
    if (Array.isArray(hasReady))
    {
        let ready = methods.match(patterns.ready);
        ready = Array.isArray(ready) ? ready.shift() : '';
        let newReady = ready.replace(/ready(\s+\(.*\)\s+\{)/, 'ready$1\nsuper.ready();\n');
        if (listeners)
        {
            newReady = newReady.replace(/\}$/, `\n${listeners}\n}`);
        }
        methods = methods.replace(ready, newReady);
    }

    [
        'attached:connectedCallback',
        'detached:disconnectedCallback',
        'attributeChanged:attributeChangedCallback',
        'created:constructor'
    ].forEach(pair => {
        pair = pair.split(':');
        let method = pair[0];
        let newMethod = pair[1];
        let pattern = new RegExp(method, 'g');
        if (pattern.test(methods))
        {
            let superCallback = method === 'created' ? 'super();' : `super.${newMethod}();`;
            methods = methods.replace(new RegExp(`${method}(.+\{)`), `${newMethod}$1\n${superCallback}\n`);
        }
    });

    let content = fs.readFileSync(path.resolve(__dirname, '../tpls/class.hbs')).toString();
    let className = capitalize(camelize(name));
    content = (Handlebars.compile(content))({
        behaviors,
        properties,
        observers,
        methods,
        className,
        name
    });
    content = content
        .replace(/&#x60;/g, '`')
        .replace(/&#x27;/g, '\'')
        .replace(/&#x3D;/g, '=')
        .replace(/&gt;/g, '>')
        .replace(/this\['(.+)'\]/g, 'this.$1')
        .replace(/this\.set\('(.+)',\s(.+)\)/g, 'this.$1 = $2')
        .replace(/this\.get\('(.+)'\)/g, 'this.$1')
        .replace(/this\.fire\((.+)\,\s+(.+)\)\;/g, 'this.dispatchEvent(new CustomEvent($1, {detail: $2}));');
    content = beautify(content, {
        indent_size: 2
    });

    fs.writeFileSync(output, content, 'utf-8');
}

function htmlReplace(root = '', name = '', output = '')
{
    let source = path.resolve(root, `${name}.html`);
    let fileContent = fs.readFileSync(source).toString();
    fileContent = fileContent
        .replace(/content/g, 'slot')
        .replace('polymer.html', 'polymer-element.html');

    output = output !== ''
        ? path.resolve(output, `${name}.html`)
        : source;
    fs.writeFileSync(output, fileContent, 'utf-8');
}

function _demoMode(root = '', demo = '')
{
    let source = path.resolve(root, `../demo/${demo}/source`);
    let output = path.resolve(root, `../demo/${demo}/output`);

    if (!fs.existsSync(output))
    {
        fs.mkdirSync(output);
    }

    htmlReplace(source, 'my-component', output);
    jsReplace(source, 'my-component', output);
}

function toPolymer2() {

    let componentName = '';
    let demoMode = process.argv.some((arg, index) => {
        let value = process.argv[index + 1];
        if (arg === '--demo')
        {
            componentName = value;
        }
        return !!componentName;
    });

    //---debug
    /*demoMode = true;
    componentName = 'complex';*/

    let baseDir = __dirname;
    if (demoMode)
    {
        _demoMode(baseDir, componentName);
    }
    else
    {
        baseDir = process.cwd();
        componentName = baseDir.substr(baseDir.lastIndexOf('/') + 1, baseDir.length);
        if (isAPolymerComponent(baseDir, componentName))
        {
            jsReplace(baseDir, componentName);
            htmlReplace(baseDir, componentName);
        }
    }
};

module.exports = toPolymer2();
// toPolymer2();
