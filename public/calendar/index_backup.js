// Process block-level custom containers
//
'use strict';


module.exports = function container_plugin(md, options) {
  name = 'calendar';

  function validateDefault(params) {
    params = params.split(' ');
    if(params.length != 2)return false;
    try{
      var year = parseInt(params[0]);
      var month = parseInt(params[1])
      return month<=12 && month >=1;
    }
    catch(err){
      return false;
    }
  }

  function renderDefault(tokens, idx, _options, env, self) {

    // add a class to the opening tag
    if (tokens[idx].nesting === 1) {
      tokens[idx].attrPush(['class', name]);
    }

    return self.renderToken(tokens, idx, _options, env, self);
  }

  options = options || {};

  var min_markers = 3,
    marker_str = options.marker || '@[calendar]',
    marker_char = marker_str.charCodeAt(0),
    marker_len = marker_str.length,
    validate = options.validate || validateDefault,
    render = options.render || renderDefault;

  function container(state, startLine, endLine, silent) {
    var pos, nextLine, marker_count, markup, params, token,
      year, month,
      old_parent, old_line_max,
      auto_closed = false,
      start = state.bMarks[startLine] + state.tShift[startLine],
      max = state.eMarks[startLine];
    // Check out the first character quickly,
    // this should filter out most of non-containers
    //
    if (marker_char !== state.src.charCodeAt(start)) {
      return false;
    }

    // Check out the rest of the marker string
    //
    for (pos = start + 1; pos <= max; pos++) {
      if (marker_str[(pos - start) % marker_len] !== state.src[pos]) {
        break;
      }
    }

    pos -= (pos - start) % marker_len;

    markup = state.src.slice(start, pos);
    params = state.src.slice(pos, max).trim();
    if (!validate(params)) {
      return false;
    }
    year = params.split(' ')[0];
    month = params.split(' ')[1];

    // Since start is found, we can report success here in validation mode
    //
    if (silent) {
      return true;
    }

    // Search for the end of the block
    //
    nextLine = startLine;

    for (;;) {
      nextLine++;
      if (nextLine >= endLine) {
        // unclosed block should be autoclosed by end of document.
        // also block seems to be autoclosed by end of parent
        break;
      }

      start = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];

      if (start < max && state.sCount[nextLine] < state.blkIndent) {
        // non-empty line with negative indent should stop the list:
        // - ```
        //  test
        break;
      }

      if (marker_char !== state.src.charCodeAt(start)) {
        continue;
      }

      if (state.sCount[nextLine] - state.blkIndent >= 4) {
        // closing fence should be indented less than 4 spaces
        continue;
      }

      for (pos = start + 1; pos <= max; pos++) {
        if (marker_str[(pos - start) % marker_len] !== state.src[pos]) {
          break;
        }
      }

      // closing code fence must be at least as long as the opening one
      if (Math.floor((pos - start) / marker_len) < marker_count) {
        continue;
      }

      // make sure tail has spaces only
      pos -= (pos - start) % marker_len;
      pos = state.skipSpaces(pos);

      if (pos < max) {
        continue;
      }

      // found!
      auto_closed = true;
      break;
    }

    old_parent = state.parentType;
    old_line_max = state.lineMax;
    state.parentType = 'container';

    // this will prevent lazy continuations from ever going past our end marker
    state.lineMax = nextLine;

    token = state.push(name + '_open', 'div', 1);
    token.markup = markup;
    token.block = true;
    token.info = params;
    token.map = [startLine, nextLine];

    state.md.block.tokenize(state, startLine + 1, nextLine);

    token = state.push(name + '_close', 'div', -1);
    token.markup = state.src.slice(start, pos);
    token.block = true;

    state.parentType = old_parent;
    state.lineMax = old_line_max;
    state.line = nextLine + (auto_closed ? 1 : 0);

    return true;
  }

  md.block.ruler.before('fence', name, container, {
    alt: ['paragraph', 'reference', 'blockquote', 'list']
  });
  md.renderer.rules[name + '_open'] = render;
  md.renderer.rules[name + '_close'] = render;
};