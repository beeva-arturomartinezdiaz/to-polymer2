const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const beautify = require('js-beautify').js_beautify;

let sources = '/';
let output = '/';

process.argv.forEach((arg, index) => {
  if (arg === '--demo') {
    sources = `demo/${process.argv[index + 1]}/source`;
    output = `demo/${process.argv[index + 1]}/output`;
  }
});

function camelize(text = '') {
  return text.split('-').map((part, index) => {
    return !!index
      ? capitalize(part)
      : part;
  }).join('.').replace(/\./g, '');
}

function capitalize(text = '') {
  return `${text.charAt(0).toUpperCase()}${text.substr(1)}`;
}

sources = path.resolve(__dirname, sources);
if (fs.existsSync(sources)) {
  let demoOutput = path.resolve(__dirname, output);
  if (!fs.existsSync(demoOutput)) {
    fs.mkdirSync(demoOutput);
  }
  fs.readdirSync(sources).forEach(file => {
    let fileExt = file.replace(/^.+\./, '');
    let fileName = file.replace(/\..+$/, '');
    let fileContent = fs.readFileSync(path.resolve(sources, file), 'utf-8').toString();
    switch(fileExt) {

      case 'html':
        fileContent = fileContent
          .replace(/content/g, 'slot')
          .replace('polymer.html', 'polymer-element.html');
        break;

      case 'js':

        let behaviors;
        if (/behaviors/.test(fileContent)) {
          let matches = fileContent.match(/behaviors\:[\n\r\s]+\[[\n\r\s]+([\w\,\n\r\s]+)\]\,/);
          if (matches[1] !== undefined) {
            behaviors = matches[1].split(',').map((behavior, index) => {
              behavior = behavior.trim();
              return !!index
                ? `, ${behavior}`
                : behavior;
            });
          }
        }

        let properties;
        if (/properties/.test(fileContent)) {
          properties = fileContent.match(/properties\:\s+\{([0-9a-zA-Z\s\/\*\@\{\}\:\'\_\,\(\)\;]+)\}/);
          properties = Array.isArray(properties) ? properties[1] : null;
          if (properties) {
            properties = properties.replace(/function\(\)/g, '() =>');
          }
        }

        let observers;
        if (/observers/.test(fileContent)) {
          observers = fileContent.match(/observers:[\n\s\t]+\[([\n\t\s\(\)\w+\,\']+)\]\,/g)[1];
        }

        let methods = fileContent.match(/[\/\*\w\@\s]+[\s]+\w+\:\sfunction\(\w+\)\s\{[\d\w\W\s]+\}/);
        methods = Array.isArray(methods) ? methods[0] : null;
        if (methods) {
          methods = methods.replace(/\}\,/g, '}').replace(/\:\sfunction\((.+)\)/g, '($1)');
        }

        let listeners = fileContent.match(/listeners:\s\{\s+(\'[\w\W]+\'\:\s\'[\w\W]+\'[\s]+)\}\,/);
        listeners = Array.isArray(listeners) ? listeners[1].split(',') : [];
        listeners = listeners.map(listener => {
          listener = listener.split(':');
          return `window.addEventListener(${listener[0].trim()}, this[${listener[1].trim()}].bind(this));`;
        });

        let hasReady = fileContent.match(/ready:\sfunction\(\)\s\{\s+(.+)\s+\}\,/);
        hasReady = Array.isArray(hasReady) ? hasReady[1] : null;
        if (hasReady) {
          hasReady = `ready(){\nsuper.ready();\n${hasReady}\n${listeners.join('\n')}}\n`;
          listeners = null;
        }

        let hasAttached = fileContent.match(/attached:\sfunction\(\)\s\{\s+(.+)\s+\}\,/);
        hasAttached = Array.isArray(hasAttached) ? hasAttached[1] : null;
        if (hasAttached) {
          hasAttached = `connectedCallback(){\nsuper.connectedCallback();\n${hasAttached}\n}\n`;
        }

        let hasDetached = fileContent.match(/detached:\sfunction\(\)\s\{\s+(.+)\s+\}\,/);
        hasDetached = Array.isArray(hasDetached) ? hasDetached[1] : null;
        if (hasDetached) {
          hasDetached = `disconnectedCallback(){\nsuper.disconnectedCallback();\n${hasDetached}\n}\n`;
        }

        let hasAttributeChanged = fileContent.match(/attributeChanged:\sfunction\(\)\s\{\s+(.+)\s+(\}|\}\,)/);
        hasAttributeChanged = Array.isArray(hasAttributeChanged) ? hasAttributeChanged[1] : null;
        if (hasAttributeChanged) {
          hasAttributeChanged = `attributedChangedCallback(){\nsuper.attributedChangedCallback();\n${hasAttributeChanged}\n}\n`;
        }

        let hasCreated = fileContent.match(/created:\sfunction\(\)\s\{\s+(.+)\s+\}\,/);
        hasCreated = Array.isArray(hasCreated)  ? hasCreated[1] : null;

        fileContent = fs.readFileSync(path.resolve(__dirname, 'class.hbs')).toString();
        let className = capitalize(camelize(fileName));
        fileContent = (Handlebars.compile(fileContent))({
          behaviors,
          properties,
          observers,
          listeners,
          hasCreated,
          hasReady,
          hasAttached,
          hasDetached,
          hasAttributeChanged,
          methods,
          className,
          fileName
        });
        fileContent = fileContent
          .replace(/&#x27;/g, '\'')
          .replace(/&#x3D;/g, '=')
          .replace(/&gt;/g, '>')
          .replace(/this\['(.+)'\]/g, 'this.$1')
          .replace(/this\.set\('(.+)',\s(.+)\)/g, 'this.$1 = $2')
          .replace(/this\.get\('(.+)'\)/g, 'this.$1')
          .replace(/this\.fire\('([\w\W]+)', ([\w\W]+)\)\;\n/g, 'this.dispatchEvent(new CustomEvent(\'$1\', {detail: $2}));');
        fileContent = beautify(fileContent, {
          indent_size: 2
        });
        break;
    }

    fs.writeFileSync(path.resolve(demoOutput, file), fileContent, 'UTF-8');
  });
}