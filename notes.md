# Future work

## Lazy/partial rendering of pages

Check out content-visibility may help https://web.dev/articles/content-visibility see also mdn docs about this.

There is a react library to render long lists inserting only the currnetly visible elements in the dom. react window. also see this for more details [patterns.dev](https://www.patterns.dev/vanilla/virtual-lists/)

A complete custom solution would just be to measure how much the user has scrolled using scrolltop and then only render the elements at that height with some buffer above and below.
For this you would have to keep track of the height of each element.
