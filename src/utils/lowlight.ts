import css from 'highlight.js/lib/languages/css'
import js from 'highlight.js/lib/languages/javascript'
import ts from 'highlight.js/lib/languages/typescript'
import java from 'highlight.js/lib/languages/java'
import rust from 'highlight.js/lib/languages/rust'
import go from 'highlight.js/lib/languages/go'
import html from 'highlight.js/lib/languages/xml'
import shell from 'highlight.js/lib/languages/shell'
import ini from 'highlight.js/lib/languages/ini'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import sql from 'highlight.js/lib/languages/sql'
import yaml from 'highlight.js/lib/languages/yaml'
import swift from 'highlight.js/lib/languages/swift'
import scss from 'highlight.js/lib/languages/scss'
import less from 'highlight.js/lib/languages/less'
import c from 'highlight.js/lib/languages/c'
import php from 'highlight.js/lib/languages/php'
import properties from 'highlight.js/lib/languages/properties'
import protobuf from 'highlight.js/lib/languages/protobuf'
import objectivec from 'highlight.js/lib/languages/objectivec'
import nginx from 'highlight.js/lib/languages/nginx'
import markdown from 'highlight.js/lib/languages/markdown'
import matlab from 'highlight.js/lib/languages/matlab'
import makefile from 'highlight.js/lib/languages/makefile'
import lua from 'highlight.js/lib/languages/lua'
import kotlin from 'highlight.js/lib/languages/kotlin'
import latex from 'highlight.js/lib/languages/latex'
import erlang from 'highlight.js/lib/languages/erlang'
import dockerfile from 'highlight.js/lib/languages/dockerfile'
import dos from 'highlight.js/lib/languages/dos'
import dns from 'highlight.js/lib/languages/dns'
import dart from 'highlight.js/lib/languages/dart'
import csharp from 'highlight.js/lib/languages/csharp'
import cpp from 'highlight.js/lib/languages/cpp'
import cmake from 'highlight.js/lib/languages/cmake'

// load all highlight.js languages
import { lowlight } from 'lowlight'

// import 'highlight.js/scss/github.scss'

lowlight.registerLanguage('html', html)
lowlight.registerLanguage('css', css)
lowlight.registerLanguage('javascript', js)
lowlight.registerLanguage('java', java)
lowlight.registerLanguage('rust', rust)
lowlight.registerLanguage('go', go)
lowlight.registerLanguage('typescript', ts)
lowlight.registerLanguage('shell', shell)
lowlight.registerLanguage('ini', ini)
lowlight.registerLanguage('json', json)
lowlight.registerLanguage('python', python)
lowlight.registerLanguage('sql', sql)
lowlight.registerLanguage('yaml', yaml)
lowlight.registerLanguage('yml', yaml)
lowlight.registerLanguage('swift', swift)
lowlight.registerLanguage('less', less)
lowlight.registerLanguage('scss', scss)
lowlight.registerLanguage('c', c)
lowlight.registerLanguage('php', php)
lowlight.registerLanguage('properties', properties)
lowlight.registerLanguage('protobuf', protobuf)
lowlight.registerLanguage('objectivec', objectivec)
lowlight.registerLanguage('nginx', nginx)
lowlight.registerLanguage('markdown', markdown)
lowlight.registerLanguage('make', makefile)
lowlight.registerLanguage('matlab', matlab)
lowlight.registerLanguage('lua', lua)
lowlight.registerLanguage('kotlin', kotlin)
lowlight.registerLanguage('latex', latex)
lowlight.registerLanguage('erlang', erlang)
lowlight.registerLanguage('dockerfile', dockerfile)
lowlight.registerLanguage('dos', dos)
lowlight.registerLanguage('dns', dns)
lowlight.registerLanguage('dart', dart)
lowlight.registerLanguage('c#', csharp)
lowlight.registerLanguage('cpp', cpp)
lowlight.registerLanguage('cmake', cmake)

export {lowlight}