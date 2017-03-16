// Process block-level custom containers
//
'use strict';


module.exports = function calendar_plugin(md, options) {

  options = options || {};

  let min_markers = 3,
      marker_str  = options.marker || '@',
      marker_char = marker_str.charCodeAt(0),
      marker_len  = marker_str.length,
      validate    = options.validate || validateDefault,
      render      = options.render || renderDefault;

  function validateDefault(params) {
    return params.trim() === 'calendar';
  }

  function renderDefault(tokens, idx, _options, env, self) {

    // add a class to the opening tag
    tokens[idx].attrPush('class', 'calendar');
    return self.renderToken(tokens, idx, _options, env, self);
  }

  function calendar(state, startLine, endLine, silent) {
    var pos, nextLine, marker_count, markup, params, token,
        old_parent, old_line_max,
        auto_closed = false,
        start = state.bMarks[startLine] + state.tShift[startLine],
        max = state.eMarks[startLine];

    console.log(start, startLine, endLine, silent, marker_char);
    console.log(state);

    // Check out the first character quickly,
    // this should filter out most of non-containers
    if (marker_char !== state.src.charCodeAt(start)) { return false; }

    // Since start is found, we can report success here in validation mode
    if (silent) { return true; }

    params = 'calendar';

    if(params === 'calendar'){
      console.log("success");
    }


    token        = state.push('container_' + name + '_open', 'div', 1);
    token.markup = markup;
    token.block  = true;
    token.info   = params;

    state.md.block.tokenize(state, startLine + 1, nextLine);

    token        = state.push('container_' + name + '_close', 'div', -1);
    token.markup = state.src.slice(start, pos);
    token.block  = true;

    return true;
  }

  // md.block.ruler.before('fence', 'calendar', calendar, {
  //   alt: [ 'paragraph', 'reference', 'blockquote', 'list' ]
  // });
  md.renderer.rules['calendar_open'] = render;
  md.renderer.rules['calendar_close'] = render;

  // Question: 這個意思是我的render 只有在開始跟結尾 render
  // nesting = 1 : tag opening
  // nesting = 0 : tag selfing
  // nesting = -1 : tag closing

  // 所以我們現在應該要判斷nesting = 0 的時後 把特定的日期tag做「特定的事」就可以！

  console.log("222");
};


  // Generate tokens for input range
  //
  ParserBlock.prototype.tokenize = function (state, startLine, endLine) {
    var ok, i,
        rules = this.ruler.getRules(''),
        len = rules.length,
        line = startLine,
        hasEmptyLines = false,
        maxNesting = state.md.options.maxNesting;

    while (line < endLine) {
      state.line = line = state.skipEmptyLines(line);
      if (line >= endLine) { break; }

      // Termination condition for nested calls.
      // Nested calls currently used for blockquotes & lists
      if (state.sCount[line] < state.blkIndent) { break; }

      // If nesting level exceeded - skip tail to the end. That's not ordinary
      // situation and we should not care about content.
      if (state.level >= maxNesting) {
        state.line = endLine;
        break;
      }

      // Try all possible rules.
      // On success, rule should:
      //
      // - update `state.line`
      // - update `state.tokens`
      // - return true

      for (i = 0; i < len; i++) {
        ok = rules[i](state, line, endLine, false);
        if (ok) { break; }
      }

      // set state.tight iff we had an empty line before current tag
      // i.e. latest empty line should not count
      state.tight = !hasEmptyLines;

      // paragraph might "eat" one newline after it in nested lists
      if (state.isEmpty(state.line - 1)) {
        hasEmptyLines = true;
      }

      line = state.line;

      if (line < endLine && state.isEmpty(line)) {
        hasEmptyLines = true;
        line++;
        state.line = line;
      }
    }
  };
  

