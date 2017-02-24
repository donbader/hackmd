// Process block-level custom containers
//
'use strict';


module.exports = function calendarPlugin(md, options) {
  var name = 'calendar',
    startMarkerStr = '#[' + name + '=',
    endMarkerStr = '#[/' + name + ']',
    DATE_REGEX = /<!--\s*(\d+)\s*-->/,
    // EVENT_REGEX = /[\*\+\-]\(([0-2][0-9]:[0-5][0-9]),(.+)\)\s+(.+)/;
    EVENT_REGEX = /@\[(.*?)\](.*)/;

  /*************************************************************
   * Default validate and render function
   */

  function validateParamsDefault(params) {
    // return true if params is valid
    params = params.trim().split(' ');
    try {
      var year = parseInt(params[0]);
      var month = parseInt(params[1]);

      return month <= 12 && month >= 1;

    } catch (err) {
      return false;
    }
  }


  function renderOpenAndClose(tokens, idx, _options, env, self) {
    if (tokens[idx].nesting === 1) {
      console.log("RENDER 1: ", tokens[idx]);
      tokens[idx].attrPush(['class', name]);
    }
    else if (tokens[idx].nesting === -1){
      console.log("RENDER -1: ", tokens[idx]);
    }

    return self.renderToken(tokens, idx, _options, env, self);
  }

  function renderInnerDay(tokens, idx, _options, env, self){
    if (tokens[idx].nesting === 1) {
      console.log("RENDER 1: ", tokens[idx]);
      var className = tokens[idx].info.toISOString().split('T')[0]
      tokens[idx].attrPush(['class', name + '_' + className])
    }
    else if (tokens[idx].nesting === -1){
      console.log("RENDER -1: ", tokens[idx]);
    }
    return self.renderToken(tokens, idx, _options, env, self);
  }

  function renderInnerEvent(tokens, idx, _options, env, self){
    console.log("YO", tokens[idx].info);
    return ""
  }

  /*************************************************************
   * Helper functions
   */
  function isValidDate(time) {
    // time structure must be {year: 2017, month: 12, date: 30, time: "13:14"}
    try {
      var year = (time['year']).toString()
      var month = (time['month']).toString()
      var date = (time['date'] || '').toString()
      var time = (time['time'] || '').toString()
      var str = [month, date, year, time].join(" ");
      var result = Date.parse(str);
      return isNaN(result) ? false : new Date(result)
    } catch (err) {
      console.error(err);
      return false;
    }
  }


  function isValidTime(str){
    // input str must be "xx:xx"
    try{
      str = str.split(":");
      var hour = parseInt(str[0]);
      var minute = parseInt(str[1]);
      return hour < 24 && hour > -1 && minute < 60 && minute > -1;
    }
    catch(err){
      return false;
    }
  }

  function parseStartLine(src, start, end, validateFunc) {
    // Return earlier if not match
    var valid = src[end - 1] === "]"
    if(!valid) { return false; }

    valid = src.substring(start, start + startMarkerStr.length) === startMarkerStr;
    if(!valid) { return false; }

    valid = validateFunc(src.substring(start + startMarkerStr.length, end - 1));
    if(!valid) { return false; }

    var params = src.substring(start + startMarkerStr.length, end - 1).trim().split(" ");
    return {
      year: params[0],
      month: params[1]
    }

  }

  function parseEndLine(src, start, end) {
    return src.substring(start, end).trim() == endMarkerStr;
  }

  function parseDate(src, start, end, time) {
    // extract a valid Date
    var lineStr = src.substring(start, end).trim();
    try {
      // var date = lineStr.match(/\(\s*(\d+)\s*\):/)
      var date = lineStr.match(DATE_REGEX);
      var localTime = Object.assign({}, time);
      localTime['date'] = parseInt(date[1]);
      return isValidDate(localTime);
    } catch (err) {
      return false;
    }
    return false;
  }


  function parseEvent(src, start, end) {
    var lineStr = src.substring(start, end).trim();
    try {
      var event = lineStr.match(EVENT_REGEX);
      return{
        title: event[1],
        description: event[2]
      }
    } catch (err) {
      return false;
    }
    return false;
  }

  function addToken(state, params) {
    var token = state.push(params.type, params.tag || "div", params.nesting);
    token.markup = params.markup || "";
    token.block = params.block || true;
    if("info" in params){ token.info = params.info; }
    if("map" in params){ token.map = params.map; }
    return token
  }

  function closeToken(state, openToken, map, endToken, type, parentType=name) {
    var old_parent, old_line_max;

    old_parent = state.parentType;
    old_line_max = state.lineMax;
    state.parentType = parentType;

    // this will prevent lazy continuations from ever going past our end marker
    state.lineMax = map[1];


    // To make this range be a token
    openToken.map = map
    state.md.block.tokenize(state, map[0] + 1, map[1]);

    state.parentType = old_parent;
    state.lineMax = old_line_max;
    state.line = map[0] + 1;
    console.log("CLOSE TOKEN state", state);
    console.log("CLOSE TOKEN", state.line, state.lineMax);
  }


  /*************************************************************/

  options = options || {};

  var validateParam = options.validate || validateParamsDefault,
    render = options.render || renderOpenAndClose;


  /*************************************************************
   * Rule function
   */
  function calendarRule(state, startLine, endLine, silent) {
    var pos, old_parent, old_line_max,
      currentLine,
      autoClosed = 0,
      openCalendarToken, openDayToken, openDayLine, token,
      start = state.bMarks[startLine] + state.tShift[startLine],
      end = state.eMarks[startLine],
      renderInfo = {Date:{}, Content:{}};

    var currentDay = undefined;

    // check the first line is correct
    var date = parseStartLine(state.src, start, end, validateParam);
    if (date === false) {
      return false;
    }
    if (silent) { return true; }

    renderInfo['Date'] = date

    // add token(calendar_open) to [tokens ...]
    openCalendarToken = addToken(state, {
      type: name + '_open',
      nesting: 1,
      markup: startMarkerStr,
      info: renderInfo
    });


    // iterate the lines
    for (currentLine = startLine + 1; currentLine < endLine; ++currentLine) {
      start = state.bMarks[currentLine] + state.tShift[currentLine];
      end = state.eMarks[currentLine];
      console.log(currentLine, state.src.substring(start, end));

      // Meet day line
      var day = parseDate(state.src, start, end, date);
      if (day) {
        if (currentDay){
          // End the previous day token
          token = addToken(state, {
            type: name + '_day_close',
            nesting: -1,
          });
          closeToken(state, openDayToken, [openDayLine, currentLine], token, name);
          console.log("Day_close", day, token);
        }
        // Open the day token
        openDayLine = currentLine;
        openDayToken = addToken(state, {
          type: name + '_day_open',
          nesting: 1,
          markup: state.src.substring(start, end),
          info: day
        });
        currentDay = day;
        console.log("Day_open", day, openDayToken);
        continue;
      } //======================================================

      // Meet event line
      event = parseEvent(state.src, start, end);
      if (currentDay && event) {
        console.log("Event", event);
        renderInfo['Content'][currentDay] = renderInfo['Content'][currentDay] || [];
        renderInfo['Content'][currentDay].push(event);
        continue;
      } //======================================================

      // Meet End of line
      if (state.src[start] === endMarkerStr[0] && parseEndLine(state.src, start, end)) {
        if (currentDay) {
          // End the previous day token
          token = addToken(state, {
            type: name + '_day_close',
            nesting: -1,
          });
          closeToken(state, openDayToken, [openDayLine, currentLine], token, name);
          console.log("Day_close", currentDay, token);
        }
        console.log("End", state.src.substring(start, end));
        autoClosed = 1;
        break;
      } //======================================================

    } // end for (iterate the lines)

    // add token(calendar_close) to [tokens ...]
    token = addToken(state, {
      type: name + '_close',
      nesting: -1,
      markup: endMarkerStr,
      info: renderInfo
    });
    closeToken(state, openCalendarToken, [startLine, currentLine], token, name);

    console.log("-----------------------");
    console.log(renderInfo.Date);
    console.log(renderInfo.Content);
    console.log("-----------------------");

    return true;
  }

  md.block.ruler.before('fence', name, calendarRule, {
    alt: ['paragraph', 'reference', 'blockquote', 'list']
  });
  md.renderer.rules[name + '_open'] = renderOpenAndClose;
  md.renderer.rules[name + '_close'] = renderOpenAndClose;
  md.renderer.rules[name + '_day_open'] = renderInnerDay;
  md.renderer.rules[name + '_day_close'] = renderInnerDay;

};