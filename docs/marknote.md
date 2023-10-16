# Markdown Syntax

Markdown is a easy-to-use markup language for writing and this document contains all supported markdown features.

## Headings

Headings from `h1` through `h6` are constructed with a `#` for each level:

```markdown
# H1
## H2
### H3
#### H4
##### H5
###### H6
```

Renders to:

# h1 Heading

## h2 Heading

### h3 Heading

#### h4 Heading

##### h5 Heading

###### h6 Heading

# Paragraphs

Just write normal text:

```markdown
Lorem ipsum dolor sit amet, graecis denique ei vel, at duo primis mandamus. Et legere ocurreret pri, animal tacimates complectitur ad cum. Cu eum inermis inimicus efficiendi. Labore officiis his ex, soluta officiis concludaturque ei qui, vide sensibus vim ad.
```

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
*rendered as italicized text*
```

renders to:

*rendered as italicized text*

*rendered as italicized text*

## Strikethrough

In GFM you can do strickthroughs by wrapping the text with double tildes.

```markdown
~~Strike through this text.~~
```

Which renders to:

~~Strike through this text.~~

## Link

Double click the mouse to open the link

```markdown
[MarkNote](https://github.com/cedar12/marknote)
```

Renders to:

[MarkNote](https://github.com/cedar12/marknote)

## Images

Images have a similar syntax to links but include a preceding exclamation point.

```markdown
![MarkNote](https://cdn.jsdelivr.net/gh/cedar12/picgo@main/images/202310161119553.png)
```

![](https://cdn.jsdelivr.net/gh/cedar12/picgo@main/images/202310161119553.png)

```markdown
![MarkNote](marknote.md.assets\20231016112227.128x128.png)
```

![](marknote.md.assets\20231016112227.128x128.png)

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

### Syntax highlighting

To activate the correct styling for the language inside the code block, simply add the file extension of the language you want to use directly after the first code "fence": ```` ```javascript ````, and syntax highlighting will automatically be applied in the rendered HTML (if supported by the parser). For example, to apply syntax highlighting to JavaScript code:

```javascript
// ```javascript
function main(){
	console.log('MarkNote');
}
```

```
//```
function main(){
	console.log('MarkNote');
}
```

## Math Formulas

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