# Markdown Syntax

Markdown is a easy-to-use markup language for writing and this document contains all supported markdown features.

## Table of contents

- [Markdown Syntax](#markdown-syntax)
  - [Headings](#headings)
  - [Paragraphs](#paragraphs)
  - [Breaks](#breaks)
  - [Horizontal Rule](#horizontal-rule)
  - [Emphasis](#emphasis)
    - [Bold](#bold)
    - [Italics](#italics)
    - [Strikethrough](#strikethrough)
  - [Links](#links)
    - [Autolinks](#autolinks)
    - [Inline links](#inline-links)
    - [Link titles](#link-titles)
    - [Named Anchors](#named-anchors)
  - [Images](#images)
  - [Blockquotes](#blockquotes)
  - [Lists](#lists)
    - [Unordered](#unordered)
    - [Ordered](#ordered)
    - [Time-saving Tip](#time-saving-tip)
  - [Todo List](#todo-list)
  - [Tables](#tables)
    - [Aligning cells](#aligning-cells)
  - [Code](#code)
    - [Inline code](#inline-code)
    - ["Fenced" code block](#fenced-code-block)
    - [Indented code](#indented-code)
    - [Syntax highlighting](#syntax-highlighting)
  - [Keyboard Keys](#keyboard-keys)
  - [Emojis](#emojis)
  - [Front Matter](#front-matter)
  - [Math Formulas](#math-formulas)
    - [Inline Math Formulas](#inline-math-formulas)
    - [Block Math Formulas](#block-math-formulas)
  - [Diagrams](#diagrams)
  - [Raw HTML](#raw-html)
  - [Escaping with backslashes](#escaping-with-backslashes)
  - [Credits](#credits)

## Headings

Headings from `h1` through `h6` are constructed with a `#` for each level:

```markdown
# H1
## H2
### H3
#### H4
##### H5
###### H6

Alternatively you can use ATX headings:

H1
======

H2
------
```

Renders to:

# h1 Heading

## h2 Heading

### h3 Heading

#### h4 Heading

##### h5 Heading

###### h6 Heading

Alternatively you can use underlines:

# H1

## H2

## Paragraphs

Just write normal text:

```markdown
Lorem ipsum dolor sit amet, graecis denique ei vel, at duo primis mandamus. Et legere ocurreret pri, animal tacimates complectitur ad cum. Cu eum inermis inimicus efficiendi. Labore officiis his ex, soluta officiis concludaturque ei qui, vide sensibus vim ad.
```

## Breaks

You can use multiple consecutive newline characters (`\n`) to create extra spacing between sections in a markdown document. However, if you need to ensure that extra newlines are not collapsed, you can use as many HTML `<br>` elements as you want.

Alternatively you can add **two spaces** spaces at the end of your paragraph to force a soft linebreak.

## Horizontal Rule

The HTML `<hr>` element is for creating a "thematic break" between paragraph-level elements. In markdown, you can use of the following for this purpose:

- `___`: three consecutive underscores
- `---`: three consecutive dashes
- `***`: three consecutive asterisks

Renders to:

---

---

---

## Emphasis

### Bold

For emphasizing a snippet of text with a heavier font-weight.

The following snippet of text is **rendered as bold text**.

```markdown
**rendered as bold text**
```

renders to:

**rendered as bold text**

### Italics

For emphasizing a snippet of text with italics.

The following snippet of text is *rendered as italicized text*.

```markdown
_rendered as italicized text_
```

renders to:

*rendered as italicized text*

## Strikethrough

In GFM you can do strickthroughs by wrapping the text with double tildes.

```markdown
~~Strike through this text.~~
```

Which renders to:

~~Strike through this text.~~

## Links

### Autolinks

Autolinks are absolute URIs and email addresses inside `<` and `>`. They are parsed as links, where the URI or email address itself is used as the link's label.

```markdown
<http://foo.bar.baz>
```

Renders to:

<http://foo.bar.baz>

URIs or email addresses that are not wrapped in angle brackets are not recognized as valid autolinks by markdown parsers.

### Inline links

```markdown
[Assemble](http://assemble.io)
```

Renders to (hover over the link, there is no tooltip):

[Assemble](http://assemble.io)

### Link titles

```markdown
[Upstage](https://github.com/upstage/ "Visit Upstage!")
```

Renders to (hover over the link, there should be a tooltip):

[Upstage](https://github.com/upstage/ "Visit Upstage!")

### Named Anchors

Named anchors enable you to jump to the specified anchor point on the same page. For example, each of these chapters:

```markdown
# Table of Contents
  * [Chapter 1](#chapter-1)
  * [Chapter 2](#chapter-2)
  * [Chapter 3](#chapter-3)
```

will jump to these sections:

```markdown
## Chapter 1
Content for chapter one.

## Chapter 2
Content for chapter one.

## Chapter 3 <a name="chapter-3"></a>
Content for chapter one.
```

**Anchor placement**

Note that placement of achors is arbitrary, you can put them anywhere you want, not just in headings. This makes adding cross-references easy when writing markdown.

## Images

Images have a similar syntax to links but include a preceding exclamation point.

```markdown
![Mark Text](https://raw.githubusercontent.com/marktext/marktext/develop/resources/icons/256x256/marktext.png)
```

![Mark Text](https://raw.githubusercontent.com/marktext/marktext/develop/resources/icons/256x256/marktext.png)

or

```markdown
![Alt text](hhttps://raw.githubusercontent.com/marktext/marktext/develop/resources/icons/256x256/marktext.png "Mark Text logo")
```

![Alt text](https://raw.githubusercontent.com/marktext/marktext/develop/resources/icons/256x256/marktext.png "Mark Text logo")

Like links, Images also have a footnote style syntax

```markdown
![Alt text][id]
```

![Alt text](https://raw.githubusercontent.com/marktext/marktext/develop/resources/icons/256x256/marktext.png "Mark Text logo")

With a reference later in the document defining the URL location:

```markdown
[id]: https://raw.githubusercontent.com/marktext/marktext/develop/resources/icons/256x256/marktext.png  "Mark Text logo"
```

## Blockquotes

Used for defining a section of quoting text from another source, within your document.

To create a blockquote, use `>` before any text you want to quote.

```markdown
> Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante
```

Renders to:

> Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer posuere erat a ante.

Blockquotes can also be nested:

```markdown
> Donec massa lacus, ultricies a ullamcorper in, fermentum sed augue.
Nunc augue augue, aliquam non hendrerit ac, commodo vel nisi.
>> Sed adipiscing elit vitae augue consectetur a gravida nunc vehicula. Donec auctor
odio non est accumsan facilisis. Aliquam id turpis in dolor tincidunt mollis ac eu diam.
>>> Donec massa lacus, ultricies a ullamcorper in, fermentum sed augue.
Nunc augue augue, aliquam non hendrerit ac, commodo vel nisi.
```

Renders to:

> Donec massa lacus, ultricies a ullamcorper in, fermentum sed augue. Nunc augue augue, aliquam non hendrerit ac, commodo vel nisi.
>
> > Sed adipiscing elit vitae augue consectetur a gravida nunc vehicula. Donec auctor odio non est accumsan facilisis. Aliquam id turpis in dolor tincidunt mollis ac eu diam.
> >
> > > Donec massa lacus, ultricies a ullamcorper in, fermentum sed augue. Nunc augue augue, aliquam non hendrerit ac, commodo vel nisi.

## Lists

### Unordered

A list of items in which the order of the items does not explicitly matter.

You may use any of the following symbols to denote bullets for each list item:

```markdown
* valid bullet
- valid bullet
+ valid bullet
```

For example

```markdown
+ Lorem ipsum dolor sit amet
+ Consectetur adipiscing elit
+ Integer molestie lorem at massa
+ Facilisis in pretium nisl aliquet
+ Nulla volutpat aliquam velit
  - Phasellus iaculis neque
  - Purus sodales ultricies
  - Vestibulum laoreet porttitor sem
  - Ac tristique libero volutpat at
+ Faucibus porta lacus fringilla vel
+ Aenean sit amet erat nunc
+ Eget porttitor lorem
```

Renders to:

- Lorem ipsum dolor sit amet
- Consectetur adipiscing elit
- Integer molestie lorem at massa
- Facilisis in pretium nisl aliquet
- Nulla volutpat aliquam velit
  - Phasellus iaculis neque
  - Purus sodales ultricies
  - Vestibulum laoreet porttitor sem
  - Ac tristique libero volutpat at
- Faucibus porta lacus fringilla vel
- Aenean sit amet erat nunc
- Eget porttitor lorem

### Ordered

A list of items in which the order of items does explicitly matter.

```markdown
1. Lorem ipsum dolor sit amet
2. Consectetur adipiscing elit
3. Integer molestie lorem at massa
4. Facilisis in pretium nisl aliquet
5. Nulla volutpat aliquam velit
6. Faucibus porta lacus fringilla vel
7. Aenean sit amet erat nunc
8. Eget porttitor lorem
```

Renders to:

1. Lorem ipsum dolor sit amet
2. Consectetur adipiscing elit
3. Integer molestie lorem at massa
4. Facilisis in pretium nisl aliquet
5. Nulla volutpat aliquam velit
6. Faucibus porta lacus fringilla vel
7. Aenean sit amet erat nunc
8. Eget porttitor lorem

### Time-saving Tip

Sometimes lists change, and when they do it's a pain to re-order all of the numbers. Markdown solves this problem by allowing you to simply use `1.` before each item in the list.

For example:

```markdown
1. Lorem ipsum dolor sit amet
1. Consectetur adipiscing elit
1. Integer molestie lorem at massa
1. Facilisis in pretium nisl aliquet
1. Nulla volutpat aliquam velit
1. Faucibus porta lacus fringilla vel
1. Aenean sit amet erat nunc
1. Eget porttitor lorem
```

Automatically re-numbers the items and renders to:

1. Lorem ipsum dolor sit amet
2. Consectetur adipiscing elit
3. Integer molestie lorem at massa
4. Facilisis in pretium nisl aliquet
5. Nulla volutpat aliquam velit
6. Faucibus porta lacus fringilla vel
7. Aenean sit amet erat nunc
8. Eget porttitor lorem

## Todo List

```markdown
- [ ] Lorem ipsum dolor sit amet
- [ ] Consectetur adipiscing elit
- [ ] Integer molestie lorem at massa
```

Renders to:

- [ ] Lorem ipsum dolor sit amet

- [ ] Consectetur adipiscing elit

- [ ] Integer molestie lorem at massa

**Links in todo lists**

```markdown
- [ ] [foo](#bar)
- [ ] [baz](#qux)
- [ ] [fez](#faz)
```

Renders to:

- [ ] [foo](#bar)

- [ ] [baz](#qux)

- [ ] [fez](#faz)

## Tables

Tables are created by adding pipes as dividers between each cell, and by adding a line of dashes (also separated by bars) beneath the header *(this line of dashes is required)*.

- pipes do not need to be vertically aligned.
- pipes on the left and right sides of the table are sometimes optional
- three or more dashes must be used for each cell in the separator row

Example:

```markdown
| Option | Description |
| ------ | ----------- |
| data   | path to data files to supply the data that will be passed into templates. |
| engine | engine to be used for processing templates. Handlebars is the default. |
| ext    | extension to be used for dest files. |
```

Renders to:

| Option | Description |
| --- | --- |
| data | path to data files to supply the data that will be passed into templates. |
| engine | engine to be used for processing templates. Handlebars is the default. |
| ext | extension to be used for dest files. |

### Aligning cells

**Center text in a column**

To center the text in a column, add a colon to the left and right of the dashes in the row beneath the header.

```markdown
| Option | Description |
| :-: | :-: |
| data   | path to data files to supply the data that will be passed into templates. |
| engine | engine to be used for processing templates. Handlebars is the default. |
| ext    | extension to be used for dest files. |
```

| Option | Description |
| --- | --- |
| data | path to data files to supply the data that will be passed into templates. |
| engine | engine to be used for processing templates. Handlebars is the default. |
| ext | extension to be used for dest files. |

**Right-align the text in a column**

To right-align the text in a column, add a colon to the right of the dashes in the row beneath the header.

```markdown
| Option | Description |
| ------:| -----------:|
| data   | path to data files to supply the data that will be passed into templates. |
| engine | engine to be used for processing templates. Handlebars is the default. |
| ext    | extension to be used for dest files. |
```

Renders to:

| Option | Description |
| --- | --- |
| data | path to data files to supply the data that will be passed into templates. |
| engine | engine to be used for processing templates. Handlebars is the default. |
| ext | extension to be used for dest files. |

## Code

### Inline code

Wrap inline snippets of code with a single backtick: `` ` ``.

For example, to show `<div></div>` inline with other text, just wrap it in backticks.

```markdown
For example, to show `<div></div>` inline with other text, just wrap it in backticks.
```

### "Fenced" code block

Three consecutive backticks, referred to as "code fences", are used to denote multiple lines of code: ```` ``` ````.

For example, this:

```
```html
Example text here...
```
```

Appears like this when viewed in a browser:

```html
Example text here...
```

### Indented code

You may also indent several lines of code by at least four spaces, but this is not recommended as it is harder to read, harder to maintain, and doesn't support syntax highlighting.

Example:

```markdown
    // Some comments
    line 1 of code
    line 2 of code
    line 3 of code
```

```
// Some comments
line 1 of code
line 2 of code
line 3 of code
```

### Syntax highlighting

To activate the correct styling for the language inside the code block, simply add the file extension of the language you want to use directly after the first code "fence": ```` ```javascript ````, and syntax highlighting will automatically be applied in the rendered HTML (if supported by the parser). For example, to apply syntax highlighting to JavaScript code:

```
```javascript
grunt.initConfig({
  assemble: {
    options: {
      assets: 'docs/assets',
      data: 'src/data/*.{json,yml}',
      helpers: 'src/custom-helpers.js',
      partials: ['src/partials/**/*.{hbs,md}']
    },
    pages: {
      options: {
        layout: 'default.hbs'
      },
      files: {
        './': ['src/templates/pages/index.hbs']
      }
    }
  }
});
```
```

Which renders to:

```javascript
grunt.initConfig({
  assemble: {
    options: {
      assets: 'docs/assets',
      data: 'src/data/*.{json,yml}',
      helpers: 'src/custom-helpers.js',
      partials: ['src/partials/**/*.{hbs,md}']
    },
    pages: {
      options: {
        layout: 'default.hbs'
      },
      files: {
        './': ['src/templates/pages/index.hbs']
      }
    }
  }
});
```

## Keyboard Keys

Github-Flavored Markdown (GFM) allows you to highlight keyboard keys.

For example, this:

```markdown
To copy, please press <kbd>CmdOrCtrl</kbd>+<kbd>C</kbd>

To paste, please press <kbd>CmdOrCtrl</kbd>+<kbd>V</kbd>
```

Which renders to:

To copy, please press <kbd>CmdOrCtrl</kbd>+<kbd>C</kbd>

To paste, please press <kbd>CmdOrCtrl</kbd>+<kbd>V</kbd>

## Emojis

Github-Flavored Markdown (GFM) supports also Emojis. :heart_eyes: :smile: :joy:

To add an emojis, just surround the emoji name with colons, like this:

```markdown
:heart: :zap: :cow: :dollar: :star: :tada:
```

Which renders to:

:heart: :zap: :cow: :dollar: :star: :tada:

**NOTE:** Mark Text provides an emoji picker with search functionality.

## Front Matter

Front matter allows you to insert metadata to your markdown document. The front matter block must be written in the first line before everything else, like in the examples below.

### YAML

YAML front matter blocks are identified by an opening and closing `---` line.

```markdown
---
title: YAML front matter example
key: valule
---

Lorem ipsum dolor sit amet, graecis denique ei vel, at duo primis mandamus.
```

### TOML

TOML front matter blocks are identified by an opening and closing `+++` line.

```markdown
+++
title = "YAML front matter example"
key = "value"
+++

Lorem ipsum dolor sit amet, graecis denique ei vel, at duo primis mandamus.
```

### JSON

JSON front matter blocks are identified by an opening and closing `;;;` line or `{` and `}`.

```markdown
{
"title": YAML front matter example
"key": {
  "subkey1": "value 1",
  "subkey2": "value 2"
}
}

Lorem ipsum dolor sit amet, graecis denique ei vel, at duo primis mandamus.
```

## Math Formulas

### Inline Math Formulas

Wrap one line LaTeX with a single dollar sign: `$`.

```markdown
For example, to show $\alpha \beta \gamma$ inline with other text, just wrap it in dollar signs.
```

### Block Math Formulas

Two consecutive dollar signs are used to denote multiple lines of math formulas: `$$`.

For example, this:

```markdown
$$
R_x=\begin{pmatrix}
1 & 0 & 0 & 0\\
0 & cos(a) & -sin(a) & 0\\
0 & sin(a) & cos(a) & 0\\
0 & 0 & 0 & 1
\end{pmatrix}
$$

or

$$
m=\frac{b_y-a_y}{b_x-a_x}
$$
```

$$
R_x=\begin{pmatrix}
1 & 0 & 0 & 0\\
0 & cos(a) & -sin(a) & 0\\
0 & sin(a) & cos(a) & 0\\
0 & 0 & 0 & 1
\end{pmatrix}
$$

$$
m=\frac{b_y-a_y}{b_x-a_x}
$$

## Diagrams

Mark Text support class, flow chart, gantt and sequence diagrams powered by flowchart.js, mermaid and Vega-Lite. [Code](#code) blocks with special language identifiers are used for diagrams.

For example, this:

```
## Vega-lite diagram

Please see [introduction to Vega-Lite](https://vega.github.io/vega-lite/tutorials/getting_started.html) for details.

```vega-lite
{
  "data": {
    "values": [
      {"a": "C", "b": 2}, {"a": "C", "b": 7}, {"a": "C", "b": 4},
      {"a": "D", "b": 1}, {"a": "D", "b": 2}, {"a": "D", "b": 6},
      {"a": "E", "b": 8}, {"a": "E", "b": 4}, {"a": "E", "b": 7}
    ]
  },
  "mark": "point",
  "encoding": {
    "x": {"field": "a", "type": "nominal"},
    "y": {"field": "b", "type": "quantitative"}
  }
}
```

## Flowchart

```flowchart
st=>start: Start|past
e=>end: End|future
op1=>operation: My Operation|past
op2=>operation: Stuff|current
sub1=>subroutine: My Subroutine|invalid
cond=>condition: Yes
or No?|approved:>http://www.google.com
c2=>condition: Good idea|rejected
io=>inputoutput: catch something...|future

st->op1(right)->cond
cond(yes, right)->c2
cond(no)->sub1(left)->op1
c2(yes)->io->e
c2(no)->op2->e
```

## Sequence diagram

```sequence
Title: Here is a title
A->B: Normal line
B-->C: Dashed line
C->>D: Open arrow
D-->>A: Dashed open arrow
```

## Flowchart

```mermaid
graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;
```

## Sequence diagram

```mermaid
sequenceDiagram
    participant Alice
    participant Bob
    Alice->>John: Hello John, how are you?
    loop Healthcheck
        John->>John: Fight against hypochondria
    end
    Note right of John: Some note
    John-->>Alice: Great!
    John->>Bob: How about you?
    Bob-->>John: Jolly good!
```

## Gantt diagram

```mermaid
gantt
dateFormat  YYYY-MM-DD
title Adding GANTT diagram to mermaid
excludes weekdays 2014-01-10

section A section
Completed task            :done,    des1, 2014-01-06,2014-01-08
Active task               :active,  des2, 2014-01-09, 3d
Future task               :         des3, after des2, 5d
Future task2               :         des4, after des3, 5d
```

## Class diagram (experimental)

```mermaid
classDiagram
Class01 <|-- AveryLongClass : Cool
Class03 *-- Class04
Class05 o-- Class06
Class07 .. Class08
Class09 --> C2 : Where am i?
Class09 --* C3
Class09 --|> Class07
Class07 : equals()
Class07 : Object[] elementData
Class01 : size()
Class01 : int chimp
Class01 : int gorilla
Class08 <--> C2: Cool label
```
```

## Raw HTML

Any text between `<` and `>` that looks like an HTML tag will be parsed as a raw HTML tag and rendered to HTML without escaping.

Example:

```markdown
**Visit <a href="https://github.com">Jon Schlinkert's GitHub Profile</a>.**
```

Renders to:

**Visit [Jon Schlinkert's GitHub Profile](https://github.com).**

## Escaping with backslashes

Any ASCII punctuation character may be escaped using a single backslash.

Example:

```markdown
\*this is not italic*
```

Renders to:

\*this is not italic\*

## Credits

This markdown cheatsheet was created by [@jonschlinkert](https://twitter.com/jonschlinkert) and modified. The source can be found [here](https://gist.github.com/jonschlinkert/5854601).