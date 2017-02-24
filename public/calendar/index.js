'use strict';

module.exports = function calendarPlugin(md, options) {
    var name = 'calendar',
        startMarkerStr = '#[' + name + '=',
        endMarkerStr = '#[/' + name + ']',
        DATE_REGEX = /<!--\s*(\d+)\s*-->/,
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


    function renderDefault(tokens, idx, _options, env, self) {
        var token = tokens[idx];
        console.log("Token :", token);
        return '<div class="calendar">' +
            JSON.stringify(token.info, null, 2).replace(' ', '&nbsp').replace('\n', '<br>') +
            '</div>';
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
            if (isNaN(result)) {
                return false;
            }

            // Ensure the month is same
            var newDate = new Date(result);
            if (newDate.getMonth() === parseInt(month) - 1)
                return newDate;

        } catch (err) {
            return false;
        }
        return false;
    }


    function isValidTime(str) {
        // input str must be "xx:xx"
        try {
            str = str.split(":");
            var hour = parseInt(str[0]);
            var minute = parseInt(str[1]);
            return hour < 24 && hour > -1 && minute < 60 && minute > -1;
        } catch (err) {
            return false;
        }
    }

    function parseStartLine(src, start, end, validateFunc) {
        // Return earlier if not match
        var valid = src[end - 1] === "]"
        if (!valid) {
            return false;
        }

        valid = src.substring(start, start + startMarkerStr.length) === startMarkerStr;
        if (!valid) {
            return false;
        }

        valid = validateFunc(src.substring(start + startMarkerStr.length, end - 1));
        if (!valid) {
            return false;
        }

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
            return {
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
        token.content = params.content || "";
        if ("info" in params) {
            token.info = params.info;
        }
        if ("map" in params) {
            token.map = params.map;
        }
        return token
    }


    /*************************************************************/

    options = options || {};

    var validateParam = options.validateParam || validateParamsDefault,
        render = options.render || renderDefault;


    /*************************************************************
     * Rule function
     */
    function calendarRule(state, startLine, endLine, silent) {
        var currentLine,
            autoClosed = 0,
            token,
            start = state.bMarks[startLine] + state.tShift[startLine],
            end = state.eMarks[startLine],
            renderInfo = {
                Date: {},
                Content: {}
            };

        var currentDay = undefined;

        // check the first line is correct
        var date = parseStartLine(state.src, start, end, validateParam);
        if (date === false) {
            return false;
        }
        if (silent) {
            return true;
        }

        renderInfo['Date'] = date


        // iterate the lines
        for (currentLine = startLine + 1; currentLine < endLine; ++currentLine) {
            start = state.bMarks[currentLine] + state.tShift[currentLine];
            end = state.eMarks[currentLine];

            // Meet day line
            var day = parseDate(state.src, start, end, date);
            if (day) {
                currentDay = day;
                continue;
            } //======================================================

            // Meet event line
            event = parseEvent(state.src, start, end);
            if (currentDay && event) {
                renderInfo['Content'][currentDay] = renderInfo['Content'][currentDay] || [];
                renderInfo['Content'][currentDay].push(event);
                continue;
            } //======================================================

            // Meet End of line
            if (state.src[start] === endMarkerStr[0] && parseEndLine(state.src, start, end)) {
                autoClosed = 1;
                break;
            } //======================================================

        } // end for (iterate the lines)

        state.line = currentLine + autoClosed;
        // add token(calendar_open) to [tokens ...]
        token = addToken(state, {
            type: name,
            nesting: 0,
            markup: startMarkerStr,
            info: renderInfo,
            map: [startLine, state.line],
            content: ""
        });

        return true;
    }

    md.block.ruler.before('fence', name, calendarRule, {
        alt: ['paragraph', 'reference', 'blockquote', 'list']
    });
    md.renderer.rules[name] = renderDefault;

};