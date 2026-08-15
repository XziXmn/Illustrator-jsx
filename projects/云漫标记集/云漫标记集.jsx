
////////////////////////////////////////////////////////////JSON/////////////////////////////////////////////////////////////////
//  JSON文件
//  json2.js
//  2023-05-10
//  Public Domain.
//  NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

//  USE YOUR OWN COPY. IT IS EXTREMELY UNWISE TO LOAD CODE FROM SERVERS YOU DO
//  NOT CONTROL.

//  This file creates a global JSON object containing two methods: stringify
//  and parse. This file provides the ES5 JSON capability to ES3 systems.
//  If a project might run on IE8 or earlier, then this file should be included.
//  This file does nothing on ES5 systems.

//      JSON.stringify(value, replacer, space)
//          value       any JavaScript value, usually an object or array.
//          replacer    an optional parameter that determines how object
//                      values are stringified for objects. It can be a
//                      function or an array of strings.
//          space       an optional parameter that specifies the indentation
//                      of nested structures. If it is omitted, the text will
//                      be packed without extra whitespace. If it is a number,
//                      it will specify the number of spaces to indent at each
//                      level. If it is a string (such as "\t" or "&nbsp;"),
//                      it contains the characters used to indent at each level.
//          This method produces a JSON text from a JavaScript value.
//          When an object value is found, if the object contains a toJSON
//          method, its toJSON method will be called and the result will be
//          stringified. A toJSON method does not serialize: it returns the
//          value represented by the name/value pair that should be serialized,
//          or undefined if nothing should be serialized. The toJSON method
//          will be passed the key associated with the value, and this will be
//          bound to the value.

//          For example, this would serialize Dates as ISO strings.

//              Date.prototype.toJSON = function (key) {
//                  function f(n) {
//                      // Format integers to have at least two digits.
//                      return (n < 10)
//                          ? "0" + n
//                          : n;
//                  }
//                  return this.getUTCFullYear()   + "-" +
//                       f(this.getUTCMonth() + 1) + "-" +
//                       f(this.getUTCDate())      + "T" +
//                       f(this.getUTCHours())     + ":" +
//                       f(this.getUTCMinutes())   + ":" +
//                       f(this.getUTCSeconds())   + "Z";
//              };

//          You can provide an optional replacer method. It will be passed the
//          key and value of each member, with this bound to the containing
//          object. The value that is returned from your method will be
//          serialized. If your method returns undefined, then the member will
//          be excluded from the serialization.

//          If the replacer parameter is an array of strings, then it will be
//          used to select the members to be serialized. It filters the results
//          such that only members with keys listed in the replacer array are
//          stringified.

//          Values that do not have JSON representations, such as undefined or
//          functions, will not be serialized. Such values in objects will be
//          dropped; in arrays they will be replaced with null. You can use
//          a replacer function to replace those with JSON values.

//          JSON.stringify(undefined) returns undefined.

//          The optional space parameter produces a stringification of the
//          value that is filled with line breaks and indentation to make it
//          easier to read.

//          If the space parameter is a non-empty string, then that string will
//          be used for indentation. If the space parameter is a number, then
//          the indentation will be that many spaces.

//          Example:

//          text = JSON.stringify(["e", {pluribus: "unum"}]);
//          // text is '["e",{"pluribus":"unum"}]'

//          text = JSON.stringify(["e", {pluribus: "unum"}], null, "\t");
//          // text is '[\n\t"e",\n\t{\n\t\t"pluribus": "unum"\n\t}\n]'

//          text = JSON.stringify([new Date()], function (key, value) {
//              return this[key] instanceof Date
//                  ? "Date(" + this[key] + ")"
//                  : value;
//          });
//          // text is '["Date(---current time---)"]'

//      JSON.parse(text, reviver)
//          This method parses a JSON text to produce an object or array.
//          It can throw a SyntaxError exception.

//          The optional reviver parameter is a function that can filter and
//          transform the results. It receives each of the keys and values,
//          and its return value is used instead of the original value.
//          If it returns what it received, then the structure is not modified.
//          If it returns undefined then the member is deleted.

//          Example:

//          // Parse the text. Values that look like ISO date strings will
//          // be converted to Date objects.

//          myData = JSON.parse(text, function (key, value) {
//              var a;
//              if (typeof value === "string") {
//                  a =
//   /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
//                  if (a) {
//                      return new Date(Date.UTC(
//                         +a[1], +a[2] - 1, +a[3], +a[4], +a[5], +a[6]
//                      ));
//                  }
//                  return value;
//              }
//          });

//          myData = JSON.parse(
//              "[\"Date(09/09/2001)\"]",
//              function (key, value) {
//                  var d;
//                  if (
//                      typeof value === "string"
//                      && value.slice(0, 5) === "Date("
//                      && value.slice(-1) === ")"
//                  ) {
//                      d = new Date(value.slice(5, -1));
//                      if (d) {
//                          return d;
//                      }
//                  }
//                  return value;
//              }
//          );

//  This is a reference implementation. You are free to copy, modify, or
//  redistribute.

/*jslint
    eval, for, this
*/

/*property
    JSON, apply, call, charCodeAt, getUTCDate, getUTCFullYear, getUTCHours,
    getUTCMinutes, getUTCMonth, getUTCSeconds, hasOwnProperty, join,
    lastIndex, length, parse, prototype, push, replace, slice, stringify,
    test, toJSON, toString, valueOf
*/


// Create a JSON object only if one does not already exist. We create the
// methods in a closure to avoid creating global variables.
if (typeof JSON !== "object") {
    JSON = {};
}

(function () {
    "use strict";

    var rx_one = /^[\],:{}\s]*$/;
    var rx_two = /\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g;
    var rx_three = /"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g;
    var rx_four = /(?:^|:|,)(?:\s*\[)+/g;
    var rx_escapable = /[\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
    var rx_dangerous = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;

    function f(n) {
        // Format integers to have at least two digits.
        return (n < 10)
            ? "0" + n
            : n;
    }

    function this_value() {
        return this.valueOf();
    }

    if (typeof Date.prototype.toJSON !== "function") {

        Date.prototype.toJSON = function () {

            return isFinite(this.valueOf())
                ? (
                    this.getUTCFullYear()
                    + "-"
                    + f(this.getUTCMonth() + 1)
                    + "-"
                    + f(this.getUTCDate())
                    + "T"
                    + f(this.getUTCHours())
                    + ":"
                    + f(this.getUTCMinutes())
                    + ":"
                    + f(this.getUTCSeconds())
                    + "Z"
                )
                : null;
        };

        Boolean.prototype.toJSON = this_value;
        Number.prototype.toJSON = this_value;
        String.prototype.toJSON = this_value;
    }

    var gap;
    var indent;
    var meta;
    var rep;


    function quote(string) {

// If the string contains no control characters, no quote characters, and no
// backslash characters, then we can safely slap some quotes around it.
// Otherwise we must also replace the offending characters with safe escape
// sequences.

        rx_escapable.lastIndex = 0;
        return rx_escapable.test(string)
            ? "\"" + string.replace(rx_escapable, function (a) {
                var c = meta[a];
                return typeof c === "string"
                    ? c
                    : "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4);
            }) + "\""
            : "\"" + string + "\"";
    }


    function str(key, holder) {

// Produce a string from holder[key].

        var i;          // The loop counter.
        var k;          // The member key.
        var v;          // The member value.
        var length;
        var mind = gap;
        var partial;
        var value = holder[key];

// If the value has a toJSON method, call it to obtain a replacement value.

        if (
            value
            && typeof value === "object"
            && typeof value.toJSON === "function"
        ) {
            value = value.toJSON(key);
        }

// If we were called with a replacer function, then call the replacer to
// obtain a replacement value.

        if (typeof rep === "function") {
            value = rep.call(holder, key, value);
        }

// What happens next depends on the value's type.

        switch (typeof value) {
        case "string":
            return quote(value);

        case "number":

// JSON numbers must be finite. Encode non-finite numbers as null.

            return (isFinite(value))
                ? String(value)
                : "null";

        case "boolean":
        case "null":

// If the value is a boolean or null, convert it to a string. Note:
// typeof null does not produce "null". The case is included here in
// the remote chance that this gets fixed someday.

            return String(value);

// If the type is "object", we might be dealing with an object or an array or
// null.

        case "object":

// Due to a specification blunder in ECMAScript, typeof null is "object",
// so watch out for that case.

            if (!value) {
                return "null";
            }

// Make an array to hold the partial results of stringifying this object value.

            gap += indent;
            partial = [];

// Is the value an array?

            if (Object.prototype.toString.apply(value) === "[object Array]") {

// The value is an array. Stringify every element. Use null as a placeholder
// for non-JSON values.

                length = value.length;
                for (i = 0; i < length; i += 1) {
                    partial[i] = str(i, value) || "null";
                }

// Join all of the elements together, separated with commas, and wrap them in
// brackets.

                v = partial.length === 0
                    ? "[]"
                    : gap
                        ? (
                            "[\n"
                            + gap
                            + partial.join(",\n" + gap)
                            + "\n"
                            + mind
                            + "]"
                        )
                        : "[" + partial.join(",") + "]";
                gap = mind;
                return v;
            }

// If the replacer is an array, use it to select the members to be stringified.

            if (rep && typeof rep === "object") {
                length = rep.length;
                for (i = 0; i < length; i += 1) {
                    if (typeof rep[i] === "string") {
                        k = rep[i];
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (
                                (gap)
                                    ? ": "
                                    : ":"
                            ) + v);
                        }
                    }
                }
            } else {

// Otherwise, iterate through all of the keys in the object.

                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (
                                (gap)
                                    ? ": "
                                    : ":"
                            ) + v);
                        }
                    }
                }
            }

// Join all of the member texts together, separated with commas,
// and wrap them in braces.

            v = partial.length === 0
                ? "{}"
                : gap
                    ? "{\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "}"
                    : "{" + partial.join(",") + "}";
            gap = mind;
            return v;
        }
    }

// If the JSON object does not yet have a stringify method, give it one.

    if (typeof JSON.stringify !== "function") {
        meta = {    // table of character substitutions
            "\b": "\\b",
            "\t": "\\t",
            "\n": "\\n",
            "\f": "\\f",
            "\r": "\r",
            "\"": "\\\"",
            "\\": "\\\\"
        };
        JSON.stringify = function (value, replacer, space) {

// The stringify method takes a value and an optional replacer, and an optional
// space parameter, and returns a JSON text. The replacer can be a function
// that can replace values, or an array of strings that will select the keys.
// A default replacer method can be provided. Use of the space parameter can
// produce text that is more easily readable.

            var i;
            gap = "";
            indent = "";

// If the space parameter is a number, make an indent string containing that
// many spaces.

            if (typeof space === "number") {
                for (i = 0; i < space; i += 1) {
                    indent += " ";
                }

// If the space parameter is a string, it will be used as the indent string.

            } else if (typeof space === "string") {
                indent = space;
            }

// If there is a replacer, it must be a function or an array.
// Otherwise, throw an error.

            rep = replacer;
            if (replacer && typeof replacer !== "function" && (
                typeof replacer !== "object"
                || typeof replacer.length !== "number"
            )) {
                throw new Error("JSON.stringify");
            }

// Make a fake root object containing our value under the key of "".
// Return the result of stringifying the value.

            return str("", {"": value});
        };
    }


// If the JSON object does not yet have a parse method, give it one.

    if (typeof JSON.parse !== "function") {
        JSON.parse = function (text, reviver) {

// The parse method takes a text and an optional reviver function, and returns
// a JavaScript value if the text is a valid JSON text.

            var j;

            function walk(holder, key) {

// The walk method is used to recursively walk the resulting structure so
// that modifications can be made.

                var k;
                var v;
                var value = holder[key];
                if (value && typeof value === "object") {
                    for (k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            v = walk(value, k);
                            if (v !== undefined) {
                                value[k] = v;
                            } else {
                                delete value[k];
                            }
                        }
                    }
                }
                return reviver.call(holder, key, value);
            }


// Parsing happens in four stages. In the first stage, we replace certain
// Unicode characters with escape sequences. JavaScript handles many characters
// incorrectly, either silently deleting them, or treating them as line endings.

            text = String(text);
            rx_dangerous.lastIndex = 0;
            if (rx_dangerous.test(text)) {
                text = text.replace(rx_dangerous, function (a) {
                    return (
                        "\\u"
                        + ("0000" + a.charCodeAt(0).toString(16)).slice(-4)
                    );
                });
            }

// In the second stage, we run the text against regular expressions that look
// for non-JSON patterns. We are especially concerned with "()" and "new"
// because they can cause invocation, and "=" because it can cause mutation.
// But just to be safe, we want to reject all unexpected forms.

// We split the second stage into 4 regexp operations in order to work around
// crippling inefficiencies in IE's and Safari's regexp engines. First we
// replace the JSON backslash pairs with "@" (a non-JSON character). Second, we
// replace all simple value tokens with "]" characters. Third, we delete all
// open brackets that follow a colon or comma or that begin the text. Finally,
// we look to see that the remaining characters are only whitespace or "]" or
// "," or ":" or "{" or "}". If that is so, then the text is safe for eval.

            if (
                rx_one.test(
                    text
                        .replace(rx_two, "@")
                        .replace(rx_three, "]")
                        .replace(rx_four, "")
                )
            ) {

// In the third stage we use the eval function to compile the text into a
// JavaScript structure. The "{" operator is subject to a syntactic ambiguity
// in JavaScript: it can begin a block or an object literal. We wrap the text
// in parens to eliminate the ambiguity.

                j = eval("(" + text + ")");

// In the optional fourth stage, we recursively walk the new structure, passing
// each name/value pair to a reviver function for possible transformation.

                return (typeof reviver === "function")
                    ? walk({"": j}, "")
                    : j;
            }

// If the text is not JSON parseable, then a SyntaxError is thrown.

            throw new SyntaxError("JSON.parse");
        };
    }}());
////////////////////////////////////////////////////////////JSON/////////////////////////////////////////////////////////////////

var doc;
if (app.documents.length == 0) {
    alert("请先建立一个新文件", "错误");
    app.documents.add();
}
    
// DIALOG
// ======
var dialog = new Window("dialog"); 
    dialog.text = "云漫标记集 Ver 0.7.4.3";
    dialog.alignChildren = ["center","center"]; 
    dialog.spacing = 10; 
    dialog.margins = 23; 

// GENERALGROUP1
// =============
var GeneralGroup1 = dialog.add("group", undefined, {name: "GeneralGroup1"}); 
    GeneralGroup1.orientation = "row"; 
    GeneralGroup1.alignChildren = ["left","top"]; 
    GeneralGroup1.spacing = 10; 
    GeneralGroup1.margins = 0; 

// GROUP1
// ======
var group1 = GeneralGroup1.add("group", undefined, {name: "group1"}); 
    group1.orientation = "column"; 
    group1.alignChildren = ["left","center"]; 
    group1.spacing = 10; 
    group1.margins = 0; 

// PANEL_1
// =======
var Panel_1 = group1.add("panel", undefined, undefined, {name: "Panel_1"}); 
    Panel_1.text = "标记参数"; 
    Panel_1.preferredSize.width = 148; 
    Panel_1.orientation = "column"; 
    Panel_1.alignChildren = ["left","center"]; 
    Panel_1.spacing = 10; 
    Panel_1.margins = 23; 
    Panel_1.alignment = ["left","center"]; 

// MARKGROUP_1
// ===========
var Markgroup_1 = Panel_1.add("group", undefined, {name: "Markgroup_1"}); 
    Markgroup_1.orientation = "row"; 
    Markgroup_1.alignChildren = ["left","center"]; 
    Markgroup_1.spacing = 4; 
    Markgroup_1.margins = 0; 

var statictext1 = Markgroup_1.add("statictext", undefined, undefined, {name: "statictext1"}); 
    statictext1.helpTip = "标记半径大小。"; 
    statictext1.text = "大小："; 

var markRadiusMMInput = Markgroup_1.add('edittext {properties: {name: "markRadiusMMInput"}}'); 
    markRadiusMMInput.helpTip = "单位毫米，最小4mm"; 
    markRadiusMMInput.text = 6; 
    markRadiusMMInput.preferredSize.width = 40; 

var statictext2 = Markgroup_1.add("statictext", undefined, undefined, {name: "statictext2"}); 
    statictext2.text = "mm"; 

// MARKGROUP_2
// ===========
var Markgroup_2 = Panel_1.add("group", undefined, {name: "Markgroup_2"}); 
    Markgroup_2.orientation = "row"; 
    Markgroup_2.alignChildren = ["left","center"]; 
    Markgroup_2.spacing = 4; 
    Markgroup_2.margins = 0; 

var statictext3 = Markgroup_2.add("statictext", undefined, undefined, {name: "statictext3"}); 
    statictext3.helpTip = "标记与文档之间的出血偏移间隔。"; 
    statictext3.text = "偏移："; 

var offsetMMInput = Markgroup_2.add('edittext {properties: {name: "offsetMMInput"}}'); 
    offsetMMInput.helpTip = "单位毫米，最小0mm"; 
    offsetMMInput.text = 2; 
    offsetMMInput.preferredSize.width = 40; 

var statictext4 = Markgroup_2.add("statictext", undefined, undefined, {name: "statictext4"}); 
    statictext4.text = "mm"; 

// MARKGROUP_3
// ===========
var Markgroup_3 = Panel_1.add("group", undefined, {name: "Markgroup_3"}); 
    Markgroup_3.orientation = "row"; 
    Markgroup_3.alignChildren = ["left","center"]; 
    Markgroup_3.spacing = 4; 
    Markgroup_3.margins = 0; 

var statictext5 = Markgroup_3.add("statictext", undefined, undefined, {name: "statictext5"}); 
    statictext5.helpTip = "标记线宽粗细"; 
    statictext5.text = "线宽："; 

var lineWidthInput = Markgroup_3.add('edittext {properties: {name: "lineWidthInput"}}'); 
    lineWidthInput.text = 0.07; 
    lineWidthInput.preferredSize.width = 40; 

var statictext6 = Markgroup_3.add("statictext", undefined, undefined, {name: "statictext6"}); 
    statictext6.text = "mm"; 

// MARKGROUP_4
// ===========
var Markgroup_4 = Panel_1.add("group", undefined, {name: "Markgroup_4"}); 
    Markgroup_4.orientation = "row"; 
    Markgroup_4.alignChildren = ["left","center"]; 
    Markgroup_4.spacing = 4; 
    Markgroup_4.margins = 0; 

var statictext7 = Markgroup_4.add("statictext", undefined, undefined, {name: "statictext7"});
    statictext7.helpTip = "标记线宽粗细";
    statictext7.text = "位置：";

var positionDropdown_array = ["外侧","内侧"];
var positionDropdown = Markgroup_4.add("dropdownlist", undefined, undefined, {name: "positionDropdown", items: positionDropdown_array});
    positionDropdown.selection = 0;

// PANEL_1
// =======
var divider1 = Panel_1.add("panel", undefined, undefined, {name: "divider1"}); 
    divider1.alignment = "fill"; 

var PrintingCornerLine = Panel_1.add("checkbox", undefined, undefined, {name: "PrintingCornerLine"}); 
    PrintingCornerLine.text = "印刷角线"; 
    PrintingCornerLine.value = true; 

var hotStampingMark = Panel_1.add("checkbox", undefined, undefined, {name: "hotStampingMark"}); 
    hotStampingMark.text = "冷烫标记"; 
    hotStampingMark.value = false; 

var cuttingMark = Panel_1.add("checkbox", undefined, undefined, {name: "cuttingMark"}); 
    cuttingMark.text = "马克点"; 
    cuttingMark.value = true; 

var Bisector = Panel_1.add("checkbox", undefined, undefined, {name: "Bisector"}); 
    Bisector.text = "等分线"; 

var Grating = Panel_1.add("checkbox", undefined, undefined, {name: "Grating"}); 
    Grating.text = "对位线"; 

// COMMENTPANEL
// ============
var Commentpanel = group1.add("panel", undefined, undefined, {name: "Commentpanel"}); 
    Commentpanel.text = "文档备注"; 
    Commentpanel.preferredSize.width = 148; 
    Commentpanel.orientation = "column"; 
    Commentpanel.alignChildren = ["left","top"]; 
    Commentpanel.spacing = 10; 
    Commentpanel.margins = 10; 

var Comment_text = Commentpanel.add('edittext {properties: {name: "Comment_text"}}'); 
    Comment_text.preferredSize.width = 120; 

// GENERALGROUP1_2
// ===============
var GeneralGroup1_2 = GeneralGroup1.add("group", undefined, {name: "GeneralGroup1_2"}); 
    GeneralGroup1_2.orientation = "column"; 
    GeneralGroup1_2.alignChildren = ["left","center"]; 
    GeneralGroup1_2.spacing = 10; 
    GeneralGroup1_2.margins = 0; 

// PANEL_2
// =======
var Panel_2 = GeneralGroup1_2.add("panel", undefined, undefined, {name: "Panel_2"}); 
    Panel_2.text = "选项"; 
    Panel_2.preferredSize.width = 148; 
    Panel_2.orientation = "column"; 
    Panel_2.alignChildren = ["left","center"]; 
    Panel_2.spacing = 10; 
    Panel_2.margins = 23; 
    Panel_2.alignment = ["left","center"]; 

var AdaptiveArtboard = Panel_2.add("checkbox", undefined, undefined, {name: "AdaptiveArtboard"}); 
    AdaptiveArtboard.helpTip = "是否扩展画板到标记大小。默认扩展。"; 
    AdaptiveArtboard.text = "自适应画板"; 
    AdaptiveArtboard.value = true; 

var whiteInkLayer = Panel_2.add("checkbox", undefined, undefined, {name: "whiteInkLayer"}); 
    whiteInkLayer.helpTip = "仅在启用冷烫标记后可选；白墨仅作为冷烫标记底色，不改变纸张/画板尺寸。"; 
    whiteInkLayer.text = "添加白墨图层";
    whiteInkLayer.value = false;
    whiteInkLayer.enabled = false; 

var PrintingColorSeparation = Panel_2.add("checkbox", undefined, undefined, {name: "PrintingColorSeparation"}); 
    PrintingColorSeparation.text = "添加印刷分色"; 
    PrintingColorSeparation.value = true; 

var FileInformation = Panel_2.add("checkbox", undefined, undefined, {name: "FileInformation"}); 
    FileInformation.text = "添加文档信息"; 
    FileInformation.value = true; 

// PANEL_3
// =======
var Panel_3 = GeneralGroup1_2.add("panel", undefined, undefined, {name: "Panel_3"}); 
    Panel_3.enabled = false; 
    Panel_3.text = "等分线"; 
    Panel_3.preferredSize.width = 148; 
    Panel_3.orientation = "column"; 
    Panel_3.alignChildren = ["right","top"]; 
    Panel_3.spacing = 10; 
    Panel_3.margins = 23; 

// BISECTORGROUP_1
// ===============
var Bisectorgroup_1 = Panel_3.add("group", undefined, {name: "Bisectorgroup_1"}); 
    Bisectorgroup_1.orientation = "row"; 
    Bisectorgroup_1.alignChildren = ["left","center"]; 
    Bisectorgroup_1.spacing = 4; 
    Bisectorgroup_1.margins = 0; 

var statictext8 = Bisectorgroup_1.add("statictext", undefined, undefined, {name: "statictext8"}); 
    statictext8.helpTip = "切割线水平数量"; 
    statictext8.text = "水平数："; 

var horizontalDirection = Bisectorgroup_1.add('edittext {properties: {name: "horizontalDirection"}}'); 
    horizontalDirection.helpTip = "单位毫米"; 
    horizontalDirection.text = 2; 
    horizontalDirection.preferredSize.width = 40; 

// BISECTORGROUP_2
// ===============
var Bisectorgroup_2 = Panel_3.add("group", undefined, {name: "Bisectorgroup_2"}); 
    Bisectorgroup_2.orientation = "row"; 
    Bisectorgroup_2.alignChildren = ["left","center"]; 
    Bisectorgroup_2.spacing = 4; 
    Bisectorgroup_2.margins = 0; 

var statictext9 = Bisectorgroup_2.add("statictext", undefined, undefined, {name: "statictext9"}); 
    statictext9.helpTip = "水平切割线之间间距"; 
    statictext9.text = "间距："; 

var spacing_1 = Bisectorgroup_2.add('edittext {properties: {name: "spacing_1"}}'); 
    spacing_1.helpTip = "单位毫米"; 
    spacing_1.text = 6; 
    spacing_1.preferredSize.width = 40; 

// BISECTORGROUP_3
// ===============
var Bisectorgroup_3 = Panel_3.add("group", undefined, {name: "Bisectorgroup_3"}); 
    Bisectorgroup_3.orientation = "row"; 
    Bisectorgroup_3.alignChildren = ["left","center"]; 
    Bisectorgroup_3.spacing = 4; 
    Bisectorgroup_3.margins = 0; 

var statictext10 = Bisectorgroup_3.add("statictext", undefined, undefined, {name: "statictext10"}); 
    statictext10.helpTip = "切割线垂直数量"; 
    statictext10.text = "垂直数："; 

var verticalDirection = Bisectorgroup_3.add('edittext {properties: {name: "verticalDirection"}}'); 
    verticalDirection.helpTip = "单位毫米"; 
    verticalDirection.text = 4; 
    verticalDirection.preferredSize.width = 40; 

// BISECTORGROUP_4
// ===============
var Bisectorgroup_4 = Panel_3.add("group", undefined, {name: "Bisectorgroup_4"}); 
    Bisectorgroup_4.orientation = "row"; 
    Bisectorgroup_4.alignChildren = ["left","center"]; 
    Bisectorgroup_4.spacing = 4; 
    Bisectorgroup_4.margins = 0; 

var statictext11 = Bisectorgroup_4.add("statictext", undefined, undefined, {name: "statictext11"}); 
    statictext11.helpTip = "垂直切割线之间间距"; 
    statictext11.text = "间距："; 

var spacing_2 = Bisectorgroup_4.add('edittext {properties: {name: "spacing_2"}}'); 
    spacing_2.helpTip = "单位毫米"; 
    spacing_2.text = 6; 
    spacing_2.preferredSize.width = 40; 

// BUTTONGROUP1
// ============
var buttongroup1 = dialog.add("group", undefined, {name: "buttongroup1"}); 
    buttongroup1.orientation = "row"; 
    buttongroup1.alignChildren = ["left","center"]; 
    buttongroup1.spacing = 25; 
    buttongroup1.margins = 0; 

var ok = buttongroup1.add("button", undefined, undefined, {name: "ok"}); 
    ok.text = "确定"; 

var cancel = buttongroup1.add("button", undefined, undefined, {name: "cancel"}); 
    cancel.text = "取消"; 

doc = app.activeDocument;

// 记录脚本启动时是否以“选中对象”为目标。
// 后续会取消对象选择，因此不能再依赖 doc.selection.length 判断该模式。
var selectionMode = app.activeDocument.selection.length > 0;

if (selectionMode) {
    dialog.text = dialog.text + "（已选中对象）";
    AdaptiveArtboard.enabled = false;
    AdaptiveArtboard.value = false;
    hotStampingMark.value = false;
    whiteInkLayer.value = false;
    whiteInkLayer.enabled = false;
}

var direction = {
    value: false
}
var cb6 = {
    value: false
}

positionDropdown.onChange = function(e) {
    positionDropdown.selection.text === "内侧" ? direction.value = true : direction.value = false;
    if(direction.value) {
        AdaptiveArtboard.value = false;
        AdaptiveArtboard.enabled = false;
        PrintingCornerLine.value = false;
        PrintingCornerLine.enabled = false;
    } else {
        if(app.activeDocument.selection.length <= 0) {
            AdaptiveArtboard.enabled = true;
        }
        PrintingCornerLine.enabled = true;
    }
}

// 白墨只服务于冷烫标记：未启用冷烫时不可选择，并强制取消勾选。
hotStampingMark.onClick = function () {
    if (hotStampingMark.value) {
        whiteInkLayer.enabled = true;
    } else {
        whiteInkLayer.value = false;
        whiteInkLayer.enabled = false;
    }
}

FileInformation.onClick = function () {
    FileInformation.value ? Comment_text.enabled = true : Comment_text.enabled = false
}
Bisector.onClick = function () {
    Bisector.value ? Panel_3.enabled = true : Panel_3.enabled = false
}
Grating.onClick = function () {
    if (Grating.value) lineWidthInput.text = "0.04";
}
var onClickCount = 0;
statictext5.addEventListener('click', function() {
    onClickCount += 1;
    if (onClickCount >= 5) {
        lineWidthInput.enabled = true
    }
});

var exportFolder = Folder.myDocuments + "/YM_AI_Scripts";
if (!Folder(exportFolder).exists) Folder(exportFolder).create();

var storageFile = new File(exportFolder + "/ym_settings.json");

function logRuntimeWarning(message) {
    try {
        $.writeln("[云漫标记集] " + message);
        return true;
    } catch (e) {
        return false;
    }
}

function closeFileSafely(file) {
    try {
        file.close();
        return true;
    } catch (e) {
        return false;
    }
}

function loadStoredParams(file) {
    if (!file.exists) return null;
    try {
        if (!file.open("r")) return null;
        var raw = file.read();
        file.close();
        if (!raw) return null;
        var parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch (e) {
        closeFileSafely(file);
        logRuntimeWarning("设置文件读取失败，已使用默认设置：" + e.message);
        return null;
    }
}

function saveStoredParams(file, data) {
    try {
        if (!file.open("w")) return false;
        file.write(JSON.stringify(data));
        file.close();
        return true;
    } catch (e) {
        closeFileSafely(file);
        logRuntimeWarning("设置文件保存失败：" + e.message);
        return false;
    }
}

var params = {
    "verifyWhetherDocumentMonochrome" : false,
    "lineWidthInputEnabled" : lineWidthInput.enabled
}
var savedParams = loadStoredParams(storageFile);
if (savedParams) {
    // 更新参数
    if (typeof savedParams.lineWidthInputEnabled === "boolean") {
        lineWidthInput.enabled = savedParams.lineWidthInputEnabled;
        params.lineWidthInputEnabled = savedParams.lineWidthInputEnabled;
    }
}

function parseFiniteInput(text) {
    var normalized = String(text).replace(/^\s+|\s+$/g, "");
    if (!normalized) return null;
    var value = Number(normalized);
    return isFinite(value) ? value : null;
}

var validatedInputs = null;
// 确定按钮事件
ok.onClick = function() {
    var markAreaMM = parseFiniteInput(markRadiusMMInput.text);
    var offsetMM = parseFiniteInput(offsetMMInput.text);
    var lineWidthMM = parseFiniteInput(lineWidthInput.text);
    var horizontalCount = parseFiniteInput(horizontalDirection.text);
    var verticalCount = parseFiniteInput(verticalDirection.text);
    var horizontalSpaceMM = parseFiniteInput(spacing_1.text);
    var verticalSpaceMM = parseFiniteInput(spacing_2.text);

    if (markAreaMM === null || offsetMM === null || markAreaMM < 4 || offsetMM < 0) {
        alert("输入的标记大小必须大于等于4mm且偏移大于等于0mm！", "错误");
        return;
    }
    if (lineWidthMM === null || lineWidthMM <= 0) {
        alert("线宽必须是大于0的数字！", "错误");
        return;
    }
    if (horizontalCount === null || verticalCount === null
        || horizontalCount < 1 || verticalCount < 1
        || Math.floor(horizontalCount) !== horizontalCount
        || Math.floor(verticalCount) !== verticalCount) {
        alert("等分线的水平数和垂直数必须是大于等于1的整数！", "错误");
        return;
    }
    if (horizontalSpaceMM === null || verticalSpaceMM === null
        || horizontalSpaceMM < 0 || verticalSpaceMM < 0) {
        alert("等分线间距必须是大于等于0的数字！", "错误");
        return;
    }

    validatedInputs = {
        markAreaMM: markAreaMM,
        offsetMM: offsetMM,
        lineWidthMM: lineWidthMM,
        horizontalCount: horizontalCount,
        verticalCount: verticalCount,
        horizontalSpaceMM: horizontalSpaceMM,
        verticalSpaceMM: verticalSpaceMM
    };
    dialog.close(true);
}

dialog.center();
var myReturn = dialog.show();
if (myReturn == true) {
    var aiver = app.version;
    var originalActiveLayer = doc.activeLayer;
    var originalActiveArtboardIndex = doc.artboards.getActiveArtboardIndex();
    var pointTomm = 2.83464566929134;
    var markArea = validatedInputs.markAreaMM * pointTomm; // 用户输入的大小
    var markOffset = direction.value
        ? -((validatedInputs.markAreaMM + validatedInputs.offsetMM) * pointTomm)
        : validatedInputs.offsetMM * pointTomm; // 用户输入标记与画板间距
    var strokeWidth = validatedInputs.lineWidthMM * pointTomm; // 整体描边线条宽度
    var registrationMarkWidth = validatedInputs.lineWidthMM * pointTomm; // 套准标记线条宽度
    var markSpacing = 30 * pointTomm; // 冷烫标记相邻间距（毫米）
    var markRadius = markArea / 2; // 角线十字圆半径
    var reticleLength = markArea / 2; // 标记里十字线从相交点出发每端延伸的长度
    var margin = markArea * 0.03; // 白底沿标记排列方向的覆盖余量
    var stripWidth = markArea; // 白底厚度与标记区域一致，不向纸张外缘额外扩展
    var compensation = markOffset + markRadius * 2; // 宽度补偿

    var documentColorSpace, documentMonochrome;
    // 文档专色识别/专色名称输出当前不可用，统一暂停。
    // 注意：冷烫白墨仍使用名为 White 的专色色板实现，不受此开关影响。
    var documentSpotColorInfoEnabled = false;
    var fonts = app.textFonts; // 字体信息
    var infoTextFont = getPreferredInfoFont(fonts);
    var fontSize = 9; // 字体大小
    var textHeight = 0; // 单位MM 字高
    var regRoundSize = 3.6 * pointTomm; // 四边套准圆大小
    var pw = 0;
    var ph = 0;
    var x = 0;
    var y = 0;
    var left = 0;
    var top = 0;
    var right = 0;
    var bottom = 0;
    var regGroup, topMarksGroup, rightMarksGroup, bottomMarksGroup,
        leftMarksGroup, cornerMarkGroup, textGroup, alignmentLineGroup;
    var documentInformationTextContent, dimensionInformationTextContent;

    var spotColorBeingUsedSet = {}; // 文档中使用的专色信息
    var spotColorInfo = []; // 文档中存在的专色信息

    // 冷烫信息布局异常统一收集，避免多画板时连续弹窗。
    var layoutWarnings = [];
    var currentLayoutContext = "";

    // 等分线参数
    var hBisector = validatedInputs.horizontalCount;
    var vBisector = validatedInputs.verticalCount;
    var hBSpace = validatedInputs.horizontalSpaceMM * pointTomm;
    var vBSpace = validatedInputs.verticalSpaceMM * pointTomm;
    var mCMYK = [createCMYKColor(100, 0, 0, 0), createCMYKColor(0, 100, 0, 0), createCMYKColor(0, 0, 100, 0), createCMYKColor(0, 0, 0, 100)];
    
    // 获取文档颜色模式
    documentColorSpace = doc.documentColorSpace;
    if (documentSpotColorInfoEnabled) {
        for (var i = 0, len = doc.spots.length; i < len; i++) {
            // 套版色不存入
            if ("[套版色]" != doc.spots[i].name) {
                spotColorInfo.push(getSpotColorInfo(doc.spots[i]));
            }
        }
    }

    var markLayerName = "标记图层";
    var markLayer = getLayerByName(markLayerName);
    var layerWriteIssue = getLayerWriteIssue(markLayer);
    if (!layerWriteIssue && whiteInkLayer.value && hotStampingMark.value) {
        layerWriteIssue = getLayerWriteIssue(getLayerByName("白墨层"));
    }
    if (!layerWriteIssue && !markLayer) {
        markLayer = doc.layers.add();
        markLayer.name = markLayerName;
    }
    if (layerWriteIssue) {
        alert(layerWriteIssue + "\n请先显示并解锁该图层后重试。", "无法生成标记");
    }

    try {
        if (!layerWriteIssue) {
            doc.activeLayer = markLayer;

            // 获取文档中的套版色
            var processColors = doc.swatches[1].color;
            // 文档专色信息暂停期间，不执行单色/专色使用情况扫描。
            documentMonochrome = documentSpotColorInfoEnabled
                ? isDocumentMonochrome()
                : { isMonochrome: false, color: null };

            if (doc.selection.length > 0) {
                currentLayoutContext = "选中对象";
                var obj = doc.selection;
                var selVB = getBounds(obj);
                var docName = "文件名: " + getDisplayFileName();
                left = selVB[0]; //左
                top = selVB[1]; // 上
                right = selVB[2]; // 右
                bottom = selVB[3]; // 下
                pw = selVB[2] - selVB[0];
                ph = selVB[1] - selVB[3];
                x = selVB[0];
                y = selVB[3];
                for (var i = 0; i < obj.length; i++) {
                    obj[i].selected = false;
                }
                main();
            } else if (aiver.slice(0, 2) >= 14) {
                var ab = doc.artboards.length - 1;
                if (ab >= 49) {
                    alert("注意:页面数量超过 50 时需要较多的内存与较长的运行时间，请耐心等候。\n当出现 \"PARM\"错误时，请关掉一些不用的软件以释放可用内存！", "提示");
                }
                for (var j = 0; j <= ab; j++) {
                    var artboard = doc.artboards[j];
                    doc.artboards.setActiveArtboardIndex(j);
                    var rect = artboard.artboardRect;
                    var artboardnumber = doc.artboards.getActiveArtboardIndex() + 1;
                    currentLayoutContext = "画板 " + artboardnumber;
                    var docName = "文件名: " + getDisplayFileName() + "  页码: " + doc.artboards.length + "-" + artboardnumber;
                    left = rect[0]; //左
                    top = rect[1]; // 上
                    right = rect[2]; // 右
                    bottom = rect[3]; // 下
                    // 多画板必须使用当前画板自身尺寸。
                    // doc.width/doc.height 在多画板文档中并不可靠，且前一个画板扩展后可能影响后续页面的布局判断。
                    pw = right - left;
                    ph = top - bottom;
                    x = left;
                    y = bottom;
                    main();
                }
            } else {
                currentLayoutContext = "当前画板";
                pw = doc.width;
                ph = doc.height;
                var docName = "文件名: " + getDisplayFileName();
                main();
            }

            showLayoutWarnings();
        }
    } finally {
        restoreDocumentContext(doc, originalActiveLayer, originalActiveArtboardIndex);
    }

    params.verifyWhetherDocumentMonochrome = false;
    params.lineWidthInputEnabled = lineWidthInput.enabled;

    // 保存参数到本地文件
    saveStoredParams(storageFile, params);
}

function main() {

    regGroup = doc.groupItems.add();
    // 创建各边缘标记的组
    topMarksGroup = markLayer.groupItems.add();
    rightMarksGroup = markLayer.groupItems.add();
    bottomMarksGroup = markLayer.groupItems.add();
    leftMarksGroup = markLayer.groupItems.add();
    cornerMarkGroup = markLayer.groupItems.add();
    textGroup = markLayer.groupItems.add();
    alignmentLineGroup = markLayer.groupItems.add();

    if (hotStampingMark.value) {
        createMark();
    }
    
    if (cuttingMark.value) {
        // 左上
        createCornerMark(left - markOffset - markRadius, top + markOffset + markRadius, markRadius, cornerMarkGroup);
        // 右上
        createCornerMark(right + markOffset + markRadius, top + markOffset + markRadius, markRadius, cornerMarkGroup);
        // 左下
        createCornerMark(left - markOffset - markRadius, bottom - markOffset - markRadius, markRadius, cornerMarkGroup);
        // 右下
        createCornerMark(right + markOffset + markRadius, bottom - markOffset - markRadius, markRadius, cornerMarkGroup);
    }

    if (PrintingCornerLine.value) {
        regmark();
    }

    if (Grating.value) {
        createAlignmentLine(left - markOffset - markRadius, top + markOffset + markRadius, markRadius, alignmentLineGroup, "left");
        createAlignmentLine(right + markOffset + markRadius, top + markOffset + markRadius, markRadius, alignmentLineGroup, "right");
        createAlignmentLine(left - markOffset - markRadius, top + markOffset + markRadius, markRadius, alignmentLineGroup, "top");   
        createAlignmentLine(left - markOffset - markRadius, bottom - markOffset - markRadius, markRadius, alignmentLineGroup, "bottom");
    } else if (PrintingCornerLine.value) {
        if (!Grating.value) {
        // 左上
        createAngularLine(left - markOffset - markRadius, top + markOffset + markRadius, markRadius, cornerMarkGroup, "upperLeft");
        // // 右上
        createAngularLine(right + markOffset + markRadius, top + markOffset + markRadius, markRadius, cornerMarkGroup, "upperRight");
        // // 左下
        createAngularLine(left - markOffset - markRadius, bottom - markOffset - markRadius, markRadius, cornerMarkGroup, "leftLower");
        // // 右下
        createAngularLine(right + markOffset + markRadius, bottom - markOffset - markRadius, markRadius, cornerMarkGroup, "lowRight");
        }
    }
    
    if (whiteInkLayer.value && hotStampingMark.value) {
        var layerName = "白墨层";
        var newLayer = getLayerByName(layerName);
        if (!newLayer) {
            newLayer = doc.layers.add();
            newLayer.name = layerName;
        }
        newLayer.blendingMode = BlendModes.DARKEN; // 设置图层混合模式为变暗
        var rectangleGroup = newLayer.groupItems.add();
        // 创建白底
        createBorderRectanglesInsideArtboard(rectangleGroup);
    }

    if (Bisector.value) {
        bisector();
    }
    // 创建文字
    if (FileInformation.value) {
        documentInformationTextContent = docName + filenameDate();
        dimensionInformationTextContent = pagesize();
        if (Comment_text.text) {
            documentInformationTextContent += " 注释 : " + Comment_text.text + "。";
        }
        createText();
    }
    // 创建分色信息
    if (PrintingColorSeparation.value) {
        colorname();
    }
    if (AdaptiveArtboard.value) {
        // 画板扩展只由标记最外缘决定；白墨始终限制在标记区域内，不参与尺寸计算。
        rect[0] -= markOffset + markArea; // 左边
        rect[3] -= markOffset + markArea; // 下边
        rect[1] += markOffset + markArea; // 上边
        rect[2] += markOffset + markArea; // 右边
        // 设置新的画板尺寸
        artboard.artboardRect = rect;
        // 当前 main() 后续仍以本页为基准，避免多画板时 doc.width/doc.height 污染下一步判断。
        pw = rect[2] - rect[0];
        ph = rect[1] - rect[3];
        modifyTextFrame(textGroup, "dimensionInformationText", pagesize());
    }

}
// 创建识别标识：四边都生成；中点留给角线，向两边每 30mm 铺一颗，距扩展后边角不足 30mm 则停
function createMark() {
    var midX = (left + right) / 2;
    var midY = (top + bottom) / 2;
    var expanded = getExpandedArtboardBounds();
    placeHotStampMarksOnEdge(midX, top + markOffset + reticleLength, "h", expanded.left, expanded.right, topMarksGroup);
    placeHotStampMarksOnEdge(midX, bottom - markOffset - reticleLength, "h", expanded.left, expanded.right, bottomMarksGroup);
    placeHotStampMarksOnEdge(right + markOffset + reticleLength, midY, "v", expanded.bottom, expanded.top, rightMarksGroup);
    placeHotStampMarksOnEdge(left - markOffset - reticleLength, midY, "v", expanded.bottom, expanded.top, leftMarksGroup);
}

function getExpandedArtboardBounds() {
    var extraLeft = 0;
    var extraRight = 0;
    var extraTop = 0;
    var extraBottom = 0;
    if (AdaptiveArtboard.value) {
        var pad = markOffset + markArea; // 白墨不改变扩展范围
        extraLeft = extraRight = extraTop = extraBottom = pad;
    }
    return {
        left: left - extraLeft,
        right: right + extraRight,
        top: top + extraTop,
        bottom: bottom - extraBottom
    };
}

function collectOutwardPositions(mid, end) {
    var tol = 0.05 * pointTomm;
    var sign = end > mid ? 1 : -1;
    var positions = [];
    var step = 1;
    while (step < 200) {
        var p = mid + sign * step * markSpacing;
        var remaining = (sign > 0) ? (end - p) : (p - end);
        if (remaining + tol < markSpacing) break;
        positions.push(p);
        step++;
    }
    return positions;
}

function filterHotStampPositions(positions, cx, cy, axis) {
    var out = [];
    for (var i = 0; i < positions.length; i++) {
        var mx = (axis === "h") ? positions[i] : cx;
        var my = (axis === "h") ? cy : positions[i];
        if (cuttingMark.value && isCoveredByCornerMark(mx, my)) continue;
        out.push(positions[i]);
    }
    return out;
}

function getHotStampEdgePositions(cx, cy, axis, low, high) {
    var mid = (axis === "h") ? cx : cy;
    return {
        low: filterHotStampPositions(collectOutwardPositions(mid, low), cx, cy, axis),
        high: filterHotStampPositions(collectOutwardPositions(mid, high), cx, cy, axis)
    };
}

function placeHotStampSequence(positions, cx, cy, axis, group) {
    for (var i = 0; i < positions.length; i++) {
        var mx = (axis === "h") ? positions[i] : cx;
        var my = (axis === "h") ? cy : positions[i];
        createMarkWithNumber(mx, my, (i % 2) + 1, group, processColors);
    }
}

function placeHotStampMarksOnEdge(cx, cy, axis, low, high, group) {
    var parts = getHotStampEdgePositions(cx, cy, axis, low, high);
    placeHotStampSequence(parts.low, cx, cy, axis, group);
    placeHotStampSequence(parts.high, cx, cy, axis, group);
}

function isCoveredByCornerMark(mx, my) {
    var r = markRadius;
    var cover = r + reticleLength;
    var coverSq = cover * cover;
    var corners = [
        [left - markOffset - r, top + markOffset + r],
        [right + markOffset + r, top + markOffset + r],
        [left - markOffset - r, bottom - markOffset - r],
        [right + markOffset + r, bottom - markOffset - r]
    ];
    for (var i = 0; i < corners.length; i++) {
        var dx = mx - corners[i][0];
        var dy = my - corners[i][1];
        if (dx * dx + dy * dy < coverSq) return true;
    }
    return false;
}
// 1 = 圆十字，2 = 四角圆弧十字
function createMarkWithNumber(x, y, number, group, color) {
    switch (number) {
        case 1:
            createCircularReticle(x, y, (markArea / 4), reticleLength, group, color);
            break;
        case 2:
            createCircularReticleFourSidesArc(x, y, reticleLength * 0.33, reticleLength, group, color);
            break;
        default:
            alert("生成失败！");
            break;
    }
}

// 圆形十字线四边弧线
function createCircularReticleFourSidesArc(x, y, offset, length, group, color) {

    var radius = length / 4; 
    var fourSidesLength = (length - radius - offset) * 0.85 //四边线长

    // 绘制垂直线（穿过中心点）
    var verticalLine = group.pathItems.add();
    verticalLine.setEntirePath([[x, y - length], [x, y + length]]);

    // 绘制水平线（穿过中心点）
    var horizontalLine = group.pathItems.add();
    horizontalLine.setEntirePath([[x - length, y], [x + length, y]]);

    // 左上角半圆
    var topLeftCornerHalfCirclePath = group.pathItems.add();
    topLeftCornerHalfCirclePath.setEntirePath([[x - radius - offset - fourSidesLength, y + offset], [x - radius - offset, y + offset], [x - offset, y + radius + offset], [x - offset, y + radius + offset + fourSidesLength]]);
    var topLeftCornerStartPoint = topLeftCornerHalfCirclePath.pathPoints[1];
    topLeftCornerStartPoint.rightDirection = [x - offset, y + offset];
    topLeftCornerStartPoint.leftDirection = topLeftCornerStartPoint.anchor;
    topLeftCornerStartPoint.pointType = PointType.SMOOTH;

    // 右上角半圆
    var topRightCornerHalfCirclePath = group.pathItems.add();
    topRightCornerHalfCirclePath.setEntirePath([[x + radius + offset + fourSidesLength, y + offset], [x + radius + offset, y + offset], [x + offset, y + radius + offset], [x + offset, y + radius + offset + fourSidesLength]]);
    var topRightCornerStartPoint = topRightCornerHalfCirclePath.pathPoints[1];
    topRightCornerStartPoint.rightDirection = [x + offset, y + offset];
    topRightCornerStartPoint.leftDirection = topRightCornerStartPoint.anchor;
    topRightCornerStartPoint.pointType = PointType.SMOOTH;

    // 左下角半圆
    var bottomLeftCornerHalfCirclePath = group.pathItems.add();
    bottomLeftCornerHalfCirclePath.setEntirePath([[x - radius - offset - fourSidesLength, y - offset], [x - radius - offset, y - offset], [x - offset, y - radius - offset], [x - offset, y - radius - offset - fourSidesLength]]);
    var bottomLeftCornerStartPoint = bottomLeftCornerHalfCirclePath.pathPoints[1];
    bottomLeftCornerStartPoint.rightDirection = [x - offset, y - offset];
    bottomLeftCornerStartPoint.leftDirection = bottomLeftCornerStartPoint.anchor;
    bottomLeftCornerStartPoint.pointType = PointType.SMOOTH;

    // 右下角半圆
    var bottomRightCornerHalfCirclePath = group.pathItems.add();
    bottomRightCornerHalfCirclePath.setEntirePath([[x + radius + offset + fourSidesLength, y - offset], [x + radius + offset, y - offset], [x + offset, y - radius - offset], [x + offset, y - radius - offset - fourSidesLength]]);
    var bottomRightCornerStartPoint = bottomRightCornerHalfCirclePath.pathPoints[1];
    bottomRightCornerStartPoint.rightDirection = [x + offset, y - offset];
    bottomRightCornerStartPoint.leftDirection = bottomRightCornerStartPoint.anchor;
    bottomRightCornerStartPoint.pointType = PointType.SMOOTH;

    topLeftCornerHalfCirclePath.stroked = true;
    topLeftCornerHalfCirclePath.filled = false;
    topLeftCornerHalfCirclePath.strokeWidth = registrationMarkWidth;
    topLeftCornerHalfCirclePath.strokeColor = color;

    topRightCornerHalfCirclePath.stroked = true;
    topRightCornerHalfCirclePath.filled = false;
    topRightCornerHalfCirclePath.strokeWidth = registrationMarkWidth;
    topRightCornerHalfCirclePath.strokeColor = color;

    bottomLeftCornerHalfCirclePath.stroked = true;
    bottomLeftCornerHalfCirclePath.filled = false;
    bottomLeftCornerHalfCirclePath.strokeWidth = registrationMarkWidth;
    bottomLeftCornerHalfCirclePath.strokeColor = color;

    bottomRightCornerHalfCirclePath.stroked = true;
    bottomRightCornerHalfCirclePath.filled = false;
    bottomRightCornerHalfCirclePath.strokeWidth = registrationMarkWidth;
    bottomRightCornerHalfCirclePath.strokeColor = color;

    verticalLine.stroked = true;
    verticalLine.filled = false;
    verticalLine.strokeWidth = registrationMarkWidth;
    verticalLine.strokeColor = color;

    horizontalLine.stroked = true;
    horizontalLine.filled = false;
    horizontalLine.strokeWidth = registrationMarkWidth;
    horizontalLine.strokeColor = color;
}
// 圆形十字线
function createCircularReticle(x, y, circleRadius, length, group, color) {
    
    var circle = group.pathItems.ellipse(y + circleRadius, x - circleRadius, circleRadius * 2, circleRadius * 2, false, true);

    var verticalLine = group.pathItems.add();
    verticalLine.setEntirePath([[x, y - length], [x, y + length]]);

    var horizontalLine = group.pathItems.add();
    horizontalLine.setEntirePath([[x - length, y], [x + length, y]]);

    circle.stroked = true;
    circle.strokeWidth = registrationMarkWidth;
    circle.filled = false;
    circle.strokeColor = color;

    verticalLine.stroked = true;
    verticalLine.filled = false;
    verticalLine.strokeWidth = registrationMarkWidth;
    verticalLine.strokeColor = color;

    horizontalLine.stroked = true;
    horizontalLine.filled = false;
    horizontalLine.strokeWidth = registrationMarkWidth;
    horizontalLine.strokeColor = color;
}
// 辅助函数用于生成实心圆和白色十字线标记
function createCornerMark(x, y, radius, group) {
    // 创建一个实心圆作为角标记，并添加到组
    var mark = group.pathItems.ellipse(y + radius, x - radius, radius * 2, radius * 2, false, true);
    mark.stroked = false;
    mark.filled = true;
    mark.fillColor = processColors;
}
// 绘制对位线
function createAlignmentLine(x, y, radius, group, g) {

    // 绘制垂直线左边
    var verticalAngularLineLeft = group.pathItems.add();
    // 右边
    var verticalAngularLineRight = group.pathItems.add();
    // 绘制水平线上边
    var horizontalAngularLineTop = group.pathItems.add();
    // 下边
    var horizontalAngularLineBottom = group.pathItems.add();

    switch (g) {
        case "left" : // 左边
            verticalAngularLineLeft.setEntirePath([
                [x + radius, y + radius],
                [x + radius, y - radius - markOffset],
                [x - radius, y - radius - markOffset],
                [x + radius, y - radius - markOffset],
                [x + radius, y - 3 * radius - ph - 2 * markOffset],
                [x + radius, y - radius - ph - markOffset],
                [x - radius, y - radius - ph - markOffset],
            ]);
            break;
        case "right" :// 右边
            verticalAngularLineRight.setEntirePath([
                [x - radius, y + radius],
                [x - radius, y - radius - markOffset],
                [x + radius, y - radius - markOffset],
                [x - radius, y - radius - markOffset],
                [x - radius, y - 3 * radius - ph - 2 * markOffset],
                [x - radius, y - radius - ph - markOffset],
                [x + radius, y - radius - ph - markOffset],
            ]);
            break;
        case "top" :// 上边
            horizontalAngularLineTop.setEntirePath([
                [x - radius, y - radius],
                [x + radius + markOffset, y - radius],
                [x + radius + markOffset, y + radius],
                [x + radius + markOffset, y - radius],
                [x + radius + markOffset + pw, y - radius],
                [x + radius + markOffset + pw, y + radius],
                [x + radius + markOffset + pw, y - radius],
                [x + 3 * radius + 2 * markOffset + pw, y - radius]
            ]);
            break;
        case "bottom" :// 下边
            horizontalAngularLineBottom.setEntirePath([
                [x - radius, y + radius],
                [x + radius + markOffset, y + radius],
                [x + radius + markOffset, y - radius],
                [x + radius + markOffset, y + radius],
                [x + radius + markOffset + pw, y + radius],
                [x + radius + markOffset + pw, y - radius],
                [x + radius + markOffset + pw, y + radius],
                [x + 3 * radius + 2 * markOffset + pw, y + radius]
            ]);
            break;
        default:
            alert("类型错误！")
            break;
    }

    verticalAngularLineLeft.stroked = true;
    verticalAngularLineLeft.filled = false;
    verticalAngularLineLeft.strokeWidth = strokeWidth;
    verticalAngularLineLeft.strokeColor = processColors;

    verticalAngularLineRight.stroked = true;
    verticalAngularLineRight.filled = false;
    verticalAngularLineRight.strokeWidth = strokeWidth;
    verticalAngularLineRight.strokeColor = processColors;

    horizontalAngularLineTop.stroked = true;
    horizontalAngularLineTop.filled = false;
    horizontalAngularLineTop.strokeWidth = strokeWidth;
    horizontalAngularLineTop.strokeColor = processColors;

    horizontalAngularLineBottom.stroked = true;
    horizontalAngularLineBottom.filled = false;
    horizontalAngularLineBottom.strokeWidth = strokeWidth;
    horizontalAngularLineBottom.strokeColor = processColors;

}
// 生成角线
function createAngularLine(x, y, radius, group, g) {
    // 绘制垂直线
    var verticalAngularLine = group.pathItems.add();
    // 绘制水平线
    var horizontalAngularLine = group.pathItems.add();

    switch (g) {
        case "upperLeft" :// 左上角
            verticalAngularLine.setEntirePath([[x + radius, y + radius], [x + radius, y - radius - markOffset], [x - radius, y - radius - markOffset]]);
            horizontalAngularLine.setEntirePath([[x - radius, y - radius], [x + radius + markOffset, y - radius], [x + radius + markOffset, y + radius]]);
            break;
        case "upperRight" :// 右上角
            verticalAngularLine.setEntirePath([[x - radius, y + radius], [x - radius, y - radius - markOffset], [x + radius, y - radius - markOffset]]);
            horizontalAngularLine.setEntirePath([[x + radius, y - radius], [x - radius - markOffset, y - radius], [x - radius - markOffset, y + radius]]);
            break;
        case "leftLower" :// 左下角
            verticalAngularLine.setEntirePath([[x + radius, y - radius], [x + radius, y + radius + markOffset], [x - radius, y + radius + markOffset]]);
            horizontalAngularLine.setEntirePath([[x - radius, y + radius], [x + radius + markOffset, y + radius], [x + radius + markOffset, y - radius]]);
            break;
        case "lowRight" :// 右下角
            verticalAngularLine.setEntirePath([[x - radius, y - radius], [x - radius, y + radius + markOffset], [x + radius, y + radius + markOffset]]);
            horizontalAngularLine.setEntirePath([[x + radius, y + radius], [x - radius - markOffset, y + radius], [x - radius - markOffset, y - radius]]);
            break;
        default:
            alert("类型错误！")
            break;
    }
    verticalAngularLine.stroked = true;
    verticalAngularLine.filled = false;
    verticalAngularLine.strokeWidth = strokeWidth;
    verticalAngularLine.strokeColor = processColors;

    horizontalAngularLine.stroked = true;
    horizontalAngularLine.filled = false;
    horizontalAngularLine.strokeWidth = strokeWidth;
    horizontalAngularLine.strokeColor = processColors;
}
// 四边对准线
function regmark() {
    var lineGroup = cornerMarkGroup.groupItems.add();
    var ellipse = lineGroup.pathItems.ellipse((regRoundSize / 2) + y, (-regRoundSize / 2) + x, regRoundSize, regRoundSize, false, true);
    ellipse.filled = false;
    ellipse.stroked = true;
    ellipse.strokeWidth = strokeWidth;
    ellipse.strokeColor = processColors;

    var line = new Array(2);
    for (var i = 0; i < 2; i += 1) {
        line[i] = lineGroup.pathItems.add();
        line[i].filled = false;
        line[i].stroked = true;
        line[i].strokeWidth = strokeWidth;
        line[i].strokeColor = processColors;
    }
    line[0].setEntirePath([
        [-(markArea / 2) + x, y],
        [(markArea / 2) + x, y]
    ]);
    line[1].setEntirePath([
        [x, -(markArea + markOffset) + y],
        [x, markArea + markOffset + y]
    ]);

    lineGroup.position = [(-lineGroup.width - markOffset) + x, ((ph + lineGroup.height) / 2) + y];
    lineGroup.duplicate().position = [pw + markOffset + x, ((ph + lineGroup.height) / 2) + y];
    lineGroup.duplicate();
    lineGroup.rotate(90);
    lineGroup.position = [((pw - lineGroup.width) / 2) + x, -markOffset + y];
    lineGroup.duplicate().position = [((pw - lineGroup.width) / 2) + x, ph + lineGroup.height + markOffset + y];
}
// 等分线
// 所有等分线的横向/纵向端点与角线的最外边界严格一致：
// 外侧模式 = 成品边界 ± (markOffset + markArea)；
// 内侧模式因 markOffset 为负值，同一公式会自然落到成品内部。
function createBisectorTick(group, x1, y1, x2, y2) {
    var line = group.pathItems.add();
    line.setEntirePath([[x1, y1], [x2, y2]]);
    line.filled = false;
    line.stroked = true;
    line.strokeWidth = strokeWidth;
    line.strokeColor = processColors;
    return line;
}

function bisector() {
    var lineGroup = regGroup.groupItems.add();

    // 与 createAngularLine / 外围标记使用同一套边界。
    var leftOuter = x - markOffset - markArea;
    var leftInner = x - markOffset;
    var rightInner = x + pw + markOffset;
    var rightOuter = x + pw + markOffset + markArea;
    var bottomOuter = y - markOffset - markArea;
    var bottomInner = y - markOffset;
    var topInner = y + ph + markOffset;
    var topOuter = y + ph + markOffset + markArea;

    // 纵向等分：在左右两侧生成水平短线。
    if (vBisector > 1) {
        if (vBSpace == 0) {
            var vEquidistant = ph / vBisector;
            for (var vML = 1; vML < vBisector; vML += 1) {
                var vPos = y + (vML * vEquidistant);
                createBisectorTick(lineGroup, leftOuter, vPos, leftInner, vPos);
                createBisectorTick(lineGroup, rightInner, vPos, rightOuter, vPos);
            }
        } else {
            var vEquidistantGap = (ph + vBSpace) / vBisector;
            for (var vMLGap = 1; vMLGap < vBisector; vMLGap += 1) {
                var vPosA = y + (vMLGap * vEquidistantGap);
                var vPosB = (y - vBSpace) + (vMLGap * vEquidistantGap);
                createBisectorTick(lineGroup, leftOuter, vPosA, leftInner, vPosA);
                createBisectorTick(lineGroup, leftOuter, vPosB, leftInner, vPosB);
                createBisectorTick(lineGroup, rightInner, vPosA, rightOuter, vPosA);
                createBisectorTick(lineGroup, rightInner, vPosB, rightOuter, vPosB);
            }
        }
    }

    // 横向等分：在上下两侧生成垂直短线。
    // 旧版 hBSpace == 0 时底边使用了 1.5*markArea / 0.5*markArea，
    // 会在默认 6mm 标记、2mm 偏移时比角线多伸出 1mm；这里统一改为精确边界。
    if (hBisector > 1) {
        if (hBSpace == 0) {
            var hEquidistant = pw / hBisector;
            for (var hML = 1; hML < hBisector; hML += 1) {
                var hPos = x + (hML * hEquidistant);
                createBisectorTick(lineGroup, hPos, bottomOuter, hPos, bottomInner);
                createBisectorTick(lineGroup, hPos, topInner, hPos, topOuter);
            }
        } else {
            var hEquidistantGap = (pw + hBSpace) / hBisector;
            for (var hMLGap = 1; hMLGap < hBisector; hMLGap += 1) {
                var hPosA = (x + (hMLGap * hEquidistantGap)) - hBSpace;
                var hPosB = x + (hMLGap * hEquidistantGap);
                createBisectorTick(lineGroup, hPosA, bottomOuter, hPosA, bottomInner);
                createBisectorTick(lineGroup, hPosB, bottomOuter, hPosB, bottomInner);
                createBisectorTick(lineGroup, hPosA, topInner, hPosA, topOuter);
                createBisectorTick(lineGroup, hPosB, topInner, hPosB, topOuter);
            }
        }
    }
}
// 创建标识白墨底色
function createBorderRectanglesInsideArtboard(rectangleGroup) {

    // 颜色名称
    var spotColorName = "White";
    // 定义一个新的专色
    var whiteInkSpot;
    if (spotColorExists(spotColorName)) {
        whiteInkSpot = doc.spots.getByName(spotColorName);
    } else {
        // 定义一个新的专色
        whiteInkSpot = doc.spots.add();
        whiteInkSpot.name = spotColorName;
        // 设置专色类型
        whiteInkSpot.colorType = ColorModel.SPOT;
        whiteInkSpot.color = createCMYKColor(100, 0, 0, 0);;
    }

    var spotColor = new SpotColor();
    spotColor.spot = whiteInkSpot;
    spotColor.tint = 100;

    if (hotStampingMark.value) {
        createWhiteInkByHotStampRange(rectangleGroup, spotColor);
    } else if (PrintingCornerLine.value) {
        createRectangle(rectangleGroup, left + margin, top + stripWidth + markOffset, (right - left) / 2 - (markArea + markOffset + margin), stripWidth, spotColor);
        createRectangle(rectangleGroup, left + (right - left) / 2 + (markArea + markOffset), top + stripWidth + markOffset, (right - left) / 2 - (markArea + markOffset + margin), stripWidth, spotColor);
        createRectangle(rectangleGroup, left + margin, bottom - markOffset, (right - left) / 2 - (markArea + markOffset + margin), stripWidth, spotColor);
        createRectangle(rectangleGroup, left + (right - left) / 2 + (markArea + markOffset), bottom - markOffset, (right - left) / 2 - (markArea + markOffset + margin), stripWidth, spotColor);
        createRectangle(rectangleGroup, left - stripWidth - markOffset, top - margin, stripWidth, (top - bottom) / 2 - (markArea + markOffset + margin), spotColor);
        createRectangle(rectangleGroup, left - stripWidth - markOffset, top - (top - bottom) / 2 - (markArea + markOffset), stripWidth, (top - bottom) / 2 - (markArea + markOffset + margin), spotColor);
        createRectangle(rectangleGroup, right + markOffset, top - margin, stripWidth, (top - bottom) / 2 - (markArea + markOffset + margin), spotColor);
        createRectangle(rectangleGroup, right + markOffset, top - (top - bottom) / 2 - (markArea + markOffset), stripWidth, (top - bottom) / 2 - (markArea + markOffset + margin), spotColor);
    } else {
        createRectangle(rectangleGroup, left + margin, top + stripWidth + markOffset, right - left - margin * 2, stripWidth, spotColor);
        createRectangle(rectangleGroup, left + margin, bottom - markOffset, right - left - margin * 2, stripWidth, spotColor);
        createRectangle(rectangleGroup, left - stripWidth - markOffset, top - margin, stripWidth, top - bottom - margin * 2, spotColor);
        createRectangle(rectangleGroup, right + markOffset, top - margin, stripWidth, top - bottom - margin * 2, spotColor);
    }

}

function getPositionRange(positions) {
    if (!positions || positions.length === 0) return null;
    var minP = positions[0];
    var maxP = positions[0];
    for (var i = 1; i < positions.length; i++) {
        if (positions[i] < minP) minP = positions[i];
        if (positions[i] > maxP) maxP = positions[i];
    }
    return { min: minP, max: maxP };
}

function addWhiteInkAlongPositions(axis, positions, stripLeft, stripTop, rectangleGroup, color) {
    var range = getPositionRange(positions);
    if (!range) return;
    var pad = reticleLength + margin;
    if (axis === "h") {
        createRectangle(rectangleGroup, range.min - pad, stripTop, (range.max + pad) - (range.min - pad), stripWidth, color);
    } else {
        createRectangle(rectangleGroup, stripLeft, range.max + pad, stripWidth, (range.max + pad) - (range.min - pad), color);
    }
}

function createWhiteInkByHotStampRange(rectangleGroup, spotColor) {
    var midX = (left + right) / 2;
    var midY = (top + bottom) / 2;
    var expanded = getExpandedArtboardBounds();
    var topY = top + markOffset + reticleLength;
    var bottomY = bottom - markOffset - reticleLength;
    var rightX = right + markOffset + reticleLength;
    var leftX = left - markOffset - reticleLength;

    var topParts = getHotStampEdgePositions(midX, topY, "h", expanded.left, expanded.right);
    var bottomParts = getHotStampEdgePositions(midX, bottomY, "h", expanded.left, expanded.right);
    var rightParts = getHotStampEdgePositions(rightX, midY, "v", expanded.bottom, expanded.top);
    var leftParts = getHotStampEdgePositions(leftX, midY, "v", expanded.bottom, expanded.top);

    addWhiteInkAlongPositions("h", topParts.low, 0, top + stripWidth + markOffset, rectangleGroup, spotColor);
    addWhiteInkAlongPositions("h", topParts.high, 0, top + stripWidth + markOffset, rectangleGroup, spotColor);
    addWhiteInkAlongPositions("h", bottomParts.low, 0, bottom - markOffset, rectangleGroup, spotColor);
    addWhiteInkAlongPositions("h", bottomParts.high, 0, bottom - markOffset, rectangleGroup, spotColor);
    addWhiteInkAlongPositions("v", leftParts.low, left - stripWidth - markOffset, 0, rectangleGroup, spotColor);
    addWhiteInkAlongPositions("v", leftParts.high, left - stripWidth - markOffset, 0, rectangleGroup, spotColor);
    addWhiteInkAlongPositions("v", rightParts.low, right + markOffset, 0, rectangleGroup, spotColor);
    addWhiteInkAlongPositions("v", rightParts.high, right + markOffset, 0, rectangleGroup, spotColor);
}
// 创建填充块
function createRectangle(rectangleGroup, x, y, rectWidth, rectHeight, color) {
    if (!isFinite(rectWidth) || !isFinite(rectHeight) || rectWidth <= 0 || rectHeight <= 0) {
        addLayoutWarning("版面过小，已跳过无效的白墨区域。");
        return null;
    }
    var rect = rectangleGroup.pathItems.rectangle(y, x, rectWidth, rectHeight);
    rect.filled = true;
    rect.fillColor = color;
    rect.stroked = false;
    rect.blendingMode = BlendModes.DARKEN;
}
// 辅助函数用于将组水平居中到画板中心
function horizontallyCenterGroupToArtboard(group) {
    var artboardCenterX = (left + right) / 2;
    var bounds = group.visibleBounds;
    var groupCenterX = (bounds[0] + bounds[2]) / 2;
    var deltaX = artboardCenterX - groupCenterX;
    group.translate(deltaX, 0);
}
// 辅助函数用于将组垂直居中到画板中心
function verticallyCenterGroupToArtboard(group) {
    var artboardCenterY = (top + bottom) / 2;
    var bounds = group.visibleBounds;
    var groupCenterY = (bounds[1] + bounds[3]) / 2;
    var deltaY = artboardCenterY - groupCenterY;
    group.translate(0, deltaY);
}
// 冷烫布局警告：同一条信息只记录一次，最后统一提示。
function addLayoutWarning(message) {
    var prefix = currentLayoutContext ? (currentLayoutContext + "：") : "";
    var full = prefix + message;
    for (var i = 0; i < layoutWarnings.length; i++) {
        if (layoutWarnings[i] === full) return;
    }
    layoutWarnings.push(full);
}

function showLayoutWarnings() {
    // 冷烫信息采用自动降级策略：文件名/尺寸/日期/备注都属于可省略信息，
    // 不再因为正常的空间不足弹窗打断批量生成。
    // 仅写入 ExtendScript 控制台，方便调试；生产使用时保持静默。
    if (!layoutWarnings || layoutWarnings.length === 0) return;
    try {
        for (var i = 0; i < layoutWarnings.length; i++) {
            $.writeln("[云漫标记集] " + layoutWarnings[i]);
        }
    } catch (e) {
        logRuntimeWarning("布局警告输出失败：" + e.message);
    }
}

// ========================== 冷烫信息自适应布局 v0.7.3 ==========================
// 所有模式显示文件名时统一去除最后一个扩展名（.ai/.eps/.pdf 等）
function getDisplayFileName() {
    var name = doc.name;
    var dotIndex = name.lastIndexOf(".");
    if (dotIndex > 0) {
        name = name.substring(0, dotIndex);
    }
    return name;
}

// 获取不带“日期:”标签的日期
function getCompactDate() {
    var today = new Date();
    return today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
}

// 多画板沿用旧规则：总页数-当前页；单画板不显示页号
function getCompactPageNumber() {
    if (doc.artboards.length <= 1) return "";
    return doc.artboards.length + "-" + (doc.artboards.getActiveArtboardIndex() + 1);
}

function round2(value) {
    return Math.round(value * 100) / 100;
}

// 将点尺寸转换为紧凑尺寸文本，不带“尺寸:”标签
function compactSizeFromPoints(widthPt, heightPt) {
    var unit = "mm";
    var sizeX = round2(widthPt / pointTomm);
    var sizeY = round2(heightPt / pointTomm);

    switch (doc.rulerUnits) {
        case RulerUnits.Centimeters:
            unit = "cm";
            sizeX = round2((widthPt / pointTomm) / 10);
            sizeY = round2((heightPt / pointTomm) / 10);
            break;
        case RulerUnits.Inches:
            unit = "in";
            sizeX = round2(widthPt / 72);
            sizeY = round2(heightPt / 72);
            break;
        case RulerUnits.Millimeters:
            unit = "mm";
            sizeX = round2((widthPt / pointTomm) + 0.001);
            sizeY = round2((heightPt / pointTomm) + 0.001);
            break;
        case RulerUnits.Points:
            unit = "pt";
            sizeX = round2(widthPt);
            sizeY = round2(heightPt);
            break;
        case RulerUnits.Pixels:
            unit = "px";
            sizeX = round2(widthPt);
            sizeY = round2(heightPt);
            break;
        case RulerUnits.Qs:
            unit = "Ha";
            sizeX = round2(widthPt * 1.41111);
            sizeY = round2(heightPt * 1.41111);
            break;
    }
    return sizeX + "×" + sizeY + unit;
}

// 判断当前是否存在会向成品边界外延伸的元素。
function hasOutwardMarkElements() {
    return hotStampingMark.value ||
        cuttingMark.value ||
        PrintingCornerLine.value ||
        Grating.value ||
        Bisector.value;
}

// 计算纸张/输出范围相对原始成品边界每一侧需要增加的尺寸。
// 1. 自适应画板开启时，必须与最终扩展后的画板尺寸一致；
// 2. 选中对象生成标记时虽然不会修改画板，但尺寸仍应反映标记实际占用的纸张范围；
// 3. 手动关闭自适应画板但仍生成外侧标记时，同样显示实际纸张需求尺寸。
function getOutputExpansionPad() {
    if (direction.value) return 0;

    var pad = 0;

    // 纸张/输出尺寸只由标记最外缘决定。
    // 白墨限定在 markArea 内，因此无论是否启用白墨，尺寸都完全一致。
    if (AdaptiveArtboard.value || hasOutwardMarkElements()) {
        pad = markOffset + markArea;
    }

    // 选中对象模式下 AdaptiveArtboard 会关闭，但 hasOutwardMarkElements()
    // 仍会让尺寸反映对象外侧标记实际占用的纸张范围。
    return Math.max(0, pad);
}

function getOutputSizePoints() {
    var pad = getOutputExpansionPad();
    return {
        width: (right - left) + pad * 2,
        height: (top - bottom) + pad * 2
    };
}

// 冷烫模式显示最终纸张/扩展后尺寸，而不是原始成品尺寸。
function getHotStampCompactSize() {
    var outputSize = getOutputSizePoints();
    return compactSizeFromPoints(outputSize.width, outputSize.height);
}

function makeInfoZone(l, t, r, b) {
    return { left: l, top: t, right: r, bottom: b };
}

function zoneWidth(zone) {
    return Math.max(0, zone.right - zone.left);
}

function zoneHeight(zone) {
    return Math.max(0, zone.top - zone.bottom);
}

function getInfoGuard() {
    return 0.10 * pointTomm;
}

function zoneUsableWidth(zone) {
    if (!zone) return 0;
    return Math.max(0, zoneWidth(zone) - getInfoGuard() * 2);
}

function zoneUsableHeight(zone) {
    if (!zone) return 0;
    return Math.max(0, zoneHeight(zone) - getInfoGuard() * 2);
}

function getOutermostPosition(list, lowSide) {
    if (!list || list.length === 0) return null;
    var value = list[0];
    for (var i = 1; i < list.length; i++) {
        if (lowSide) {
            if (list[i] < value) value = list[i];
        } else {
            if (list[i] > value) value = list[i];
        }
    }
    return value;
}

// 底边：low=左下角剩余区，high=右下角剩余区
function getHotStampBottomInfoZones() {
    // 信息必须同时避开冷烫标记和四角“印刷角线”。
    // 角线的内侧边界落在原始画板 left/right 上，因此信息区不得继续使用
    // left-markOffset / right+markOffset 作为端点，否则会穿过角线。
    var safe = 1.5 * pointTomm;
    var crossPad = 0.35 * pointTomm;
    var midX = (left + right) / 2;
    var cy = bottom - markOffset - reticleLength;
    var expanded = getExpandedArtboardBounds();
    var parts = getHotStampEdgePositions(midX, cy, "h", expanded.left, expanded.right);
    var lowMark = getOutermostPosition(parts.low, true);
    var highMark = getOutermostPosition(parts.high, false);

    // 左右端严格收在原始画板角线以内。
    var lowStart = left + safe;
    var lowEnd = lowMark !== null ? lowMark - reticleLength - safe : midX - safe;
    var highStart = highMark !== null ? highMark + reticleLength + safe : midX + safe;
    var highEnd = right - safe;
    var bandTop = bottom - markOffset - crossPad;
    var bandBottom = bottom - markOffset - markArea + crossPad;

    return {
        low: makeInfoZone(lowStart, bandTop, Math.max(lowStart, lowEnd), bandBottom),
        high: makeInfoZone(Math.min(highStart, highEnd), bandTop, highEnd, bandBottom)
    };
}

// 顶边：low=左上角剩余区，high=右上角剩余区
function getHotStampTopInfoZones() {
    var safe = 1.5 * pointTomm;
    var crossPad = 0.35 * pointTomm;
    var midX = (left + right) / 2;
    var cy = top + markOffset + reticleLength;
    var expanded = getExpandedArtboardBounds();
    var parts = getHotStampEdgePositions(midX, cy, "h", expanded.left, expanded.right);
    var lowMark = getOutermostPosition(parts.low, true);
    var highMark = getOutermostPosition(parts.high, false);

    var lowStart = left + safe;
    var lowEnd = lowMark !== null ? lowMark - reticleLength - safe : midX - safe;
    var highStart = highMark !== null ? highMark + reticleLength + safe : midX + safe;
    var highEnd = right - safe;
    var bandTop = top + markOffset + markArea - crossPad;
    var bandBottom = top + markOffset + crossPad;

    return {
        low: makeInfoZone(lowStart, bandTop, Math.max(lowStart, lowEnd), bandBottom),
        high: makeInfoZone(Math.min(highStart, highEnd), bandTop, highEnd, bandBottom)
    };
}

// 左边：low=左下角剩余区，high=左上角剩余区
function getHotStampLeftInfoZones() {
    var safe = 1.5 * pointTomm;
    var crossPad = 0.35 * pointTomm;
    var midY = (top + bottom) / 2;
    var cx = left - markOffset - reticleLength;
    var expanded = getExpandedArtboardBounds();
    var parts = getHotStampEdgePositions(cx, midY, "v", expanded.bottom, expanded.top);
    var lowMark = getOutermostPosition(parts.low, true);
    var highMark = getOutermostPosition(parts.high, false);

    // 上下端严格收在原始画板角线以内。
    var lowStart = bottom + safe;
    var lowEnd = lowMark !== null ? lowMark - reticleLength - safe : midY - safe;
    var highStart = highMark !== null ? highMark + reticleLength + safe : midY + safe;
    var highEnd = top - safe;
    var bandLeft = left - markOffset - markArea + crossPad;
    var bandRight = left - markOffset - crossPad;

    return {
        low: makeInfoZone(bandLeft, Math.max(lowStart, lowEnd), bandRight, lowStart),
        high: makeInfoZone(bandLeft, highEnd, bandRight, Math.min(highStart, highEnd))
    };
}

// 右边：low=右下角剩余区，high=右上角剩余区
function getHotStampRightInfoZones() {
    var safe = 1.5 * pointTomm;
    var crossPad = 0.35 * pointTomm;
    var midY = (top + bottom) / 2;
    var cx = right + markOffset + reticleLength;
    var expanded = getExpandedArtboardBounds();
    var parts = getHotStampEdgePositions(cx, midY, "v", expanded.bottom, expanded.top);
    var lowMark = getOutermostPosition(parts.low, true);
    var highMark = getOutermostPosition(parts.high, false);

    var lowStart = bottom + safe;
    var lowEnd = lowMark !== null ? lowMark - reticleLength - safe : midY - safe;
    var highStart = highMark !== null ? highMark + reticleLength + safe : midY + safe;
    var highEnd = top - safe;
    var bandLeft = right + markOffset + crossPad;
    var bandRight = right + markOffset + markArea - crossPad;

    return {
        low: makeInfoZone(bandLeft, Math.max(lowStart, lowEnd), bandRight, lowStart),
        high: makeInfoZone(bandLeft, highEnd, bandRight, Math.min(highStart, highEnd))
    };
}

function getPreferredInfoFont(fontCollection) {
    var preferredNames = ["MicrosoftYaHei", "MicrosoftYaHeiUI", "ArialMT"];
    var lastError = null;
    for (var i = 0; i < preferredNames.length; i++) {
        try {
            return fontCollection.getByName(preferredNames[i]);
        } catch (e) {
            lastError = e;
        }
    }
    if (fontCollection.length > 0) return fontCollection[0];
    throw new Error("当前 Illustrator 中没有可用字体。" + (lastError ? " " + lastError.message : ""));
}

function setupInfoTextFrame(frame, size) {
    frame.textRange.characterAttributes.size = size;
    frame.textRange.characterAttributes.textFont = infoTextFont;
    frame.textRange.characterAttributes.fillColor = processColors;
    frame.textRange.characterAttributes.leading = size * 1.02;
}

function frameFitsZone(frame, zone) {
    var usableW = zoneUsableWidth(zone);
    var usableH = zoneUsableHeight(zone);
    if (usableW <= 0 || usableH <= 0) return false;

    var vb = frame.visibleBounds;
    var w = vb[2] - vb[0];
    var h = vb[1] - vb[3];

    // 与最终放置使用完全相同的 guard，避免“fit=true 但 place=false”导致文字被删除。
    var tol = 0.01 * pointTomm;
    return w <= Math.max(0, usableW - tol)
        && h <= Math.max(0, usableH - tol);
}

function getFrameSize(frame) {
    var vb = frame.visibleBounds;
    return {
        width: vb[2] - vb[0],
        height: vb[1] - vb[3]
    };
}

// 连续缩放字号；使用扣除 guard 后的真实可用宽高。
function shrinkInfoFrameToZone(frame, zone, startSize, minSize) {
    var usableW = zoneUsableWidth(zone);
    var usableH = zoneUsableHeight(zone);
    if (usableW <= 0 || usableH <= 0) return false;

    var size = startSize;
    setupInfoTextFrame(frame, size);

    for (var i = 0; i < 24; i++) {
        if (frameFitsZone(frame, zone)) return true;

        var fs = getFrameSize(frame);
        if (fs.width <= 0 || fs.height <= 0) return false;

        var ratioW = usableW / fs.width;
        var ratioH = usableH / fs.height;
        var ratio = Math.min(ratioW, ratioH);
        if (!isFinite(ratio) || ratio <= 0) return false;

        // 留 3% 余量，避免 Illustrator 字体 bounds 的小数误差导致刚好压线。
        var nextSize = size * ratio * 0.97;
        if (nextSize >= size - 0.05) nextSize = size - 0.2;
        if (nextSize < minSize) nextSize = minSize;

        if (Math.abs(nextSize - size) < 0.01) break;
        size = nextSize;
        setupInfoTextFrame(frame, size);

        if (size <= minSize + 0.01) break;
    }

    return frameFitsZone(frame, zone);
}

function frameInsideZone(frame, zone) {
    if (!zone) return false;
    var vb = frame.visibleBounds;
    var guard = getInfoGuard();
    // 多画板越靠后，页面项目的绝对坐标越大，Illustrator 返回的 visibleBounds
    // 会出现极小的浮点舍入误差。放置函数本来就把文字贴在 guard 边界上，
    // 因此复核时允许 0.03mm 数值误差，避免第二页以后被误判越界并删除。
    var epsilon = 0.03 * pointTomm;
    return vb[0] + epsilon >= zone.left + guard
        && vb[2] - epsilon <= zone.right - guard
        && vb[1] - epsilon <= zone.top - guard
        && vb[3] + epsilon >= zone.bottom + guard;
}

function clampFrameInsideZone(frame, zone) {
    if (!zone) return false;

    var vb = frame.visibleBounds;
    var guard = getInfoGuard();
    var leftLimit = zone.left + guard;
    var rightLimit = zone.right - guard;
    var topLimit = zone.top - guard;
    var bottomLimit = zone.bottom + guard;
    var availableW = Math.max(0, rightLimit - leftLimit);
    var availableH = Math.max(0, topLimit - bottomLimit);
    var frameW = vb[2] - vb[0];
    var frameH = vb[1] - vb[3];

    // 如果几何尺寸本身已经超过可用区域，平移不可能解决，直接返回失败。
    var sizeEps = 0.03 * pointTomm;
    if (frameW > availableW + sizeEps || frameH > availableH + sizeEps) {
        return false;
    }

    var dx = 0;
    var dy = 0;

    if (vb[0] < leftLimit) dx = leftLimit - vb[0];
    if (vb[2] + dx > rightLimit) dx += rightLimit - (vb[2] + dx);
    if (vb[1] > topLimit) dy = topLimit - vb[1];
    if (vb[3] + dy < bottomLimit) dy += bottomLimit - (vb[3] + dy);

    if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) frame.translate(dx, dy);
    return frameInsideZone(frame, zone);
}

function placeFrameInZone(frame, zone, hAlign, vAlign) {
    if (!zone) return false;

    var vb = frame.visibleBounds;
    var frameW = vb[2] - vb[0];
    var frameH = vb[1] - vb[3];
    var guard = getInfoGuard();
    var usableLeft = zone.left + guard;
    var usableRight = zone.right - guard;
    var usableTop = zone.top - guard;
    var usableBottom = zone.bottom + guard;
    var usableW = Math.max(0, usableRight - usableLeft);
    var usableH = Math.max(0, usableTop - usableBottom);

    var sizeEps = 0.03 * pointTomm;
    if (frameW > usableW + sizeEps || frameH > usableH + sizeEps) return false;

    var targetLeft;
    var targetTop;

    if (hAlign === "right") targetLeft = usableRight - frameW;
    else if (hAlign === "center") targetLeft = usableLeft + (usableW - frameW) / 2;
    else targetLeft = usableLeft;

    if (vAlign === "bottom") targetTop = usableBottom + frameH;
    else if (vAlign === "center") targetTop = usableBottom + (usableH + frameH) / 2;
    else targetTop = usableTop;

    frame.translate(targetLeft - vb[0], targetTop - vb[1]);
    return clampFrameInsideZone(frame, zone);
}

function middleEllipsis(text, keepChars) {
    if (text.length <= keepChars) return text;
    if (keepChars <= 3) return safePrefix(text, Math.max(1, keepChars - 1)) + "…";
    var body = keepChars - 1;
    var leftChars = Math.ceil(body * 0.65);
    var rightChars = body - leftChars;
    return safePrefix(text, leftChars) + "…" + safeSuffix(text, rightChars);
}

function isHighSurrogateCode(code) {
    return code >= 0xD800 && code <= 0xDBFF;
}

function isLowSurrogateCode(code) {
    return code >= 0xDC00 && code <= 0xDFFF;
}

function safePrefix(text, count) {
    var end = Math.min(Math.max(0, count), text.length);
    if (end > 0 && end < text.length) {
        var prev = text.charCodeAt(end - 1);
        var next = text.charCodeAt(end);
        if (isHighSurrogateCode(prev) && isLowSurrogateCode(next)) end--;
    }
    return text.substring(0, end);
}

function safeSuffix(text, count) {
    var start = Math.max(0, text.length - Math.max(0, count));
    if (start > 0 && start < text.length) {
        var current = text.charCodeAt(start);
        var prev = text.charCodeAt(start - 1);
        if (isLowSurrogateCode(current) && isHighSurrogateCode(prev)) start--;
    }
    return text.substring(start);
}

// 文件名没有固定结构，放不下时只从末尾截断并添加一个省略号。
// keepChars 表示省略号之前尽量保留的前缀长度；实际调用方仍按渲染尺寸逐级尝试。
// 同时避免把 emoji / 扩展字符的 UTF-16 代理对从中间截断。
function truncateFilenameFromEnd(filename, keepChars) {
    if (!filename) return "";
    if (keepChars >= filename.length) return filename;
    var marker = "…";
    var maxPrefixChars = filename.length - marker.length - 1;
    if (maxPrefixChars < 1) return filename;
    if (keepChars > maxPrefixChars) keepChars = maxPrefixChars;
    if (keepChars < 1) keepChars = 1;
    return safePrefix(filename, keepChars) + marker;
}

// 文件名特别长时，允许文件名自身拆成两行；尺寸仍完整独占最后一行。
function splitFilenameNearMiddle(filename) {
    if (!filename || filename.length < 6) return null;
    var mid = Math.floor(filename.length / 2);
    var split = mid;
    var bestDistance = filename.length;
    var separators = " _-—–·";

    for (var i = 1; i < filename.length - 1; i++) {
        if (separators.indexOf(filename.charAt(i)) >= 0) {
            var d = Math.abs(i - mid);
            if (d < bestDistance) {
                bestDistance = d;
                split = i + 1;
            }
        }
    }

    if (split <= 1 || split >= filename.length - 1) split = mid;
    return filename.substring(0, split) + "\r" + filename.substring(split);
}

function fitHotStampMainInfo(frame, zone, filename, sizeText) {
    var fileLabel = "文件名: ";
    var sizeLabel = "尺寸: ";
    var normalSizes = [9, 8.5, 8, 7.5, 7, 6.5];
    var compactSizes = [6.5, 6, 5.5, 5, 4.5, 4, 3.5];

    // 1. 完整字段 + 完整文件名。
    frame.contents = fileLabel + filename + "\r" + sizeLabel + sizeText;
    for (var i = 0; i < normalSizes.length; i++) {
        setupInfoTextFrame(frame, normalSizes[i]);
        if (frameFitsZone(frame, zone)) return true;
    }

    // 2. 保留字段，文件名按实际空间从末尾逐级截断。
    for (var s = 0; s < compactSizes.length; s++) {
        for (var keep = filename.length - 1; keep >= 2; keep--) {
            frame.contents = fileLabel + truncateFilenameFromEnd(filename, keep)
                + "\r" + sizeLabel + sizeText;
            setupInfoTextFrame(frame, compactSizes[s]);
            if (frameFitsZone(frame, zone)) return true;
        }
    }

    // 3. 字段名也允许省略，但尽量同时保留“文件名 + 尺寸”。
    for (var s2 = 0; s2 < compactSizes.length; s2++) {
        for (var keep2 = filename.length; keep2 >= 2; keep2--) {
            var name2 = keep2 >= filename.length ? filename : truncateFilenameFromEnd(filename, keep2);
            frame.contents = name2 + "\r" + sizeText;
            setupInfoTextFrame(frame, compactSizes[s2]);
            if (frameFitsZone(frame, zone)) return true;
        }
    }

    // 4. 两项无法共存时优先留下尺寸（纸张计算最直接），字段可省略。
    for (var z = 0; z < compactSizes.length; z++) {
        frame.contents = sizeLabel + sizeText;
        setupInfoTextFrame(frame, compactSizes[z]);
        if (frameFitsZone(frame, zone)) return true;
        frame.contents = sizeText;
        setupInfoTextFrame(frame, compactSizes[z]);
        if (frameFitsZone(frame, zone)) return true;
    }

    // 5. 连尺寸都放不下：该区域允许完全省略，不再强行越界。
    return false;
}

function fitHotStampSecondaryInfo(frame, zone, pageText, dateText) {
    var dateLabel = "日期: ";
    var sizes = [9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5];

    // 1. 首选：页码数值 + 日期字段（单画板则只有日期字段）。
    var fullText = pageText
        ? (pageText + " " + dateLabel + dateText)
        : (dateLabel + dateText);
    for (var i = 0; i < sizes.length; i++) {
        frame.contents = fullText;
        setupInfoTextFrame(frame, sizes[i]);
        if (frameFitsZone(frame, zone)) return true;
    }

    // 2. 多画板允许换行。
    if (pageText) {
        for (var j = 0; j < sizes.length; j++) {
            frame.contents = pageText + "\r" + dateLabel + dateText;
            setupInfoTextFrame(frame, sizes[j]);
            if (frameFitsZone(frame, zone)) return true;
        }
    }

    // 3. 空间继续不足时，页码和“日期:”字段都可省略，优先保留日期本体。
    for (var k = 0; k < sizes.length; k++) {
        frame.contents = dateText;
        setupInfoTextFrame(frame, sizes[k]);
        if (frameFitsZone(frame, zone)) return true;
    }

    // 4. 最终可完全省略。
    return false;
}

// 冷烫模式备注：固定使用左上角剩余区。优先单行，其次两行，最后才截短。
function fitHotStampCommentInfo(frame, zone, commentText) {
    var label = "备注: ";
    var sizes = [9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5];

    // 1. 完整备注。
    for (var i = 0; i < sizes.length; i++) {
        frame.contents = label + commentText;
        setupInfoTextFrame(frame, sizes[i]);
        if (frameFitsZone(frame, zone)) return true;
    }

    // 2. 字段独占一行。
    for (var j = 0; j < sizes.length; j++) {
        frame.contents = "备注:\r" + commentText;
        setupInfoTextFrame(frame, sizes[j]);
        if (frameFitsZone(frame, zone)) return true;
    }

    // 3. 截短备注；字段保留时优先。
    for (var keep = commentText.length - 1; keep >= 2; keep--) {
        var shortComment = middleEllipsis(commentText, keep);
        for (var k = 0; k < sizes.length; k++) {
            frame.contents = label + shortComment;
            setupInfoTextFrame(frame, sizes[k]);
            if (frameFitsZone(frame, zone)) return true;
        }
    }

    // 4. 连字段也占空间时允许只留截短后的备注正文。
    for (var keep2 = commentText.length - 1; keep2 >= 2; keep2--) {
        var shortBody = middleEllipsis(commentText, keep2);
        for (var q = 0; q < sizes.length; q++) {
            frame.contents = shortBody;
            setupInfoTextFrame(frame, sizes[q]);
            if (frameFitsZone(frame, zone)) return true;
        }
    }

    return false;
}

// 四角信息始终留在外围标识区；只按画板长边切换排版方向。
// 横版沿上下边横排，竖版及正方形沿左右边旋转 270 度。
function getHotStampInfoLayout() {
    if (pw > ph) {
        var topZones = getHotStampTopInfoZones();
        var bottomZones = getHotStampBottomInfoZones();
        return {
            rotation: 0,
            comment: { zone: topZones.low, hAlign: "left", vAlign: "center" },
            secondary: { zone: topZones.high, hAlign: "right", vAlign: "center" },
            color: { zone: bottomZones.low, hAlign: "left", vAlign: "center" },
            main: { zone: bottomZones.high, hAlign: "right", vAlign: "center" }
        };
    }

    var leftZones = getHotStampLeftInfoZones();
    var rightZones = getHotStampRightInfoZones();
    return {
        rotation: 270,
        comment: { zone: leftZones.high, hAlign: "center", vAlign: "top" },
        secondary: { zone: rightZones.high, hAlign: "center", vAlign: "top" },
        color: { zone: leftZones.low, hAlign: "center", vAlign: "bottom" },
        main: { zone: rightZones.low, hAlign: "center", vAlign: "bottom" }
    };
}

function rotateHotStampInfoFrame(frame, rotation) {
    if (rotation) frame.rotate(rotation);
}

function createHotStampText() {
    var filename = getDisplayFileName();
    var sizeText = getHotStampCompactSize();
    var dateText = getCompactDate();
    var pageText = getCompactPageNumber();
    var layout = getHotStampInfoLayout();
    var commentLayout = layout.comment;
    var secondaryLayout = layout.secondary;
    var mainLayout = layout.main;

    // 右下角：文件名 + 尺寸。
    var mainFrame = textGroup.textFrames.add();
    mainFrame.name = "documentInformationText";
    mainFrame.contents = "文件名: " + filename + " 尺寸: " + sizeText;
    setupInfoTextFrame(mainFrame, fontSize);
    mainFrame.position = [0, 0];
    rotateHotStampInfoFrame(mainFrame, layout.rotation);
    var mainInfoFits = fitHotStampMainInfo(mainFrame, mainLayout.zone, filename, sizeText);
    if (mainInfoFits) {
        if (!placeFrameInZone(mainFrame, mainLayout.zone, mainLayout.hAlign, mainLayout.vAlign)) {
            // 空间不足时非必要信息允许省略。
            mainFrame.remove();
        }
    } else {
        // 绝不为了“看得到”而让文字穿过角线或其它区域。
        // 文件名/尺寸属于可省略信息，绝不为显示它们而越界。
        mainFrame.remove();
    }

    // 右上角：单画板只显示“日期:”；多画板显示“总页数-当前页 日期: ...”。
    // 页码仍然不加“页码:”字段。
    var secondaryFrame = textGroup.textFrames.add();
    secondaryFrame.name = "hotStampSecondaryInformationText";
    secondaryFrame.contents = pageText
        ? (pageText + " 日期: " + dateText)
        : ("日期: " + dateText);
    setupInfoTextFrame(secondaryFrame, fontSize);
    secondaryFrame.position = [0, 0];
    rotateHotStampInfoFrame(secondaryFrame, layout.rotation);
    var secondaryInfoFits = fitHotStampSecondaryInfo(secondaryFrame, secondaryLayout.zone, pageText, dateText);
    if (secondaryInfoFits) {
        if (!placeFrameInZone(secondaryFrame, secondaryLayout.zone, secondaryLayout.hAlign, secondaryLayout.vAlign)) {
            secondaryFrame.remove();
        }
    } else {
        secondaryFrame.remove();
    }

    // 左上角：只有填写了文档备注时才生成。
    if (Comment_text.text) {
        var commentFrame = textGroup.textFrames.add();
        commentFrame.name = "hotStampCommentInformationText";
        commentFrame.contents = "备注: " + Comment_text.text;
        setupInfoTextFrame(commentFrame, fontSize);
        commentFrame.position = [0, 0];
        rotateHotStampInfoFrame(commentFrame, layout.rotation);
        var commentInfoFits = fitHotStampCommentInfo(commentFrame, commentLayout.zone, Comment_text.text);
        if (commentInfoFits) {
            if (!placeFrameInZone(commentFrame, commentLayout.zone, commentLayout.hAlign, commentLayout.vAlign)) {
                commentFrame.remove();
            }
        } else {
            commentFrame.remove();
        }
    }
}

function appendStyledPart(record, text, color) {
    if (record.text.length > 0) record.text += " ";
    var start = record.text.length;
    record.text += text;
    record.ranges.push({ start: start, end: record.text.length, color: color });
}

function getMonochromeTextColor() {
    var color = documentMonochrome.color;
    if (spotColorInfo.length > 0) {
        for (var h = 0; h < spotColorInfo.length; h++) {
            if (spotColorBeingUsedSet[getColorString(spotColorInfo[h])]) {
                var spotColor = new SpotColor();
                spotColor.spot = doc.spots.getByName(spotColorInfo[h].name);
                spotColor.tint = 100;
                return spotColor;
            }
        }
    }
    return color;
}

function buildHotStampColorRecord(level) {
    var record = { text: "", ranges: [] };
    if (documentMonochrome.isMonochrome) {
        var monoText = level === 0 ? "单色(COLOUR)" : (level === 1 ? "单色" : "1C");
        appendStyledPart(record, monoText, getMonochromeTextColor());
        return record;
    }

    var labels;
    if (level === 0) labels = ["青色(C)", "洋红(M)", "黄色(Y)", "黑色(K)"];
    else if (level === 1) labels = ["青(C)", "红(M)", "黄(Y)", "黑(K)"];
    else labels = ["C", "M", "Y", "K"];

    for (var i = 0; i < 4; i++) appendStyledPart(record, labels[i], mCMYK[i]);

    for (var h = 0; h < spotColorInfo.length; h++) {
        if (spotColorBeingUsedSet[getColorString(spotColorInfo[h])]) {
            var sc = new SpotColor();
            sc.spot = doc.spots.getByName(spotColorInfo[h].name);
            sc.tint = 100;
            var spotName = level === 0 ? ("(" + spotColorInfo[h].name + ")") : spotColorInfo[h].name;
            appendStyledPart(record, spotName, sc);
        }
    }
    return record;
}

function applyStyledColors(frame, record) {
    for (var i = 0; i < record.ranges.length; i++) {
        var range = record.ranges[i];
        for (var j = range.start; j < range.end; j++) {
            frame.textRange.characters[j].characterAttributes.fillColor = range.color;
        }
    }
}

function setStyledRecord(frame, record, size) {
    frame.contents = record.text;
    setupInfoTextFrame(frame, size);
    applyStyledColors(frame, record);
}

function buildHotStampColorRecordMultiline() {
    var record = { text: "", ranges: [] };

    if (documentMonochrome.isMonochrome) {
        appendStyledPart(record, "单色", getMonochromeTextColor());
        return record;
    }

    var labels = ["C", "M", "Y", "K"];
    for (var i = 0; i < 4; i++) appendStyledPart(record, labels[i], mCMYK[i]);

    var hasSpot = false;
    for (var h = 0; h < spotColorInfo.length; h++) {
        if (spotColorBeingUsedSet[getColorString(spotColorInfo[h])]) {
            if (!hasSpot) {
                record.text += "\r";
                hasSpot = true;
            } else {
                record.text += " ";
            }
            var sc = new SpotColor();
            sc.spot = doc.spots.getByName(spotColorInfo[h].name);
            sc.tint = 100;
            var start = record.text.length;
            record.text += spotColorInfo[h].name;
            record.ranges.push({ start: start, end: record.text.length, color: sc });
        }
    }

    return record;
}

// 冷烫极限兜底：专色名称、中文色名都可以省略，但 CMYK 标识必须最后保留。
// 单色文档则用 1C，避免错误宣称为 CMYK。
function buildHotStampMinimalColorRecord(tight) {
    var record = { text: "", ranges: [] };
    if (documentMonochrome.isMonochrome) {
        appendStyledPart(record, "1C", getMonochromeTextColor());
        return record;
    }

    var letters = ["C", "M", "Y", "K"];
    for (var i = 0; i < 4; i++) {
        if (!tight && record.text.length > 0) record.text += " ";
        var start = record.text.length;
        record.text += letters[i];
        record.ranges.push({ start: start, end: record.text.length, color: mCMYK[i] });
    }
    return record;
}

function fitHotStampColorInfo(frame, zone) {
    var levelSizes = [
        [9, 8.5, 8],
        [9, 8.5, 8, 7.5],
        [9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5]
    ];

    // 1. 尽量保留完整分色 + 专色信息。
    for (var level = 0; level < 3; level++) {
        var record = buildHotStampColorRecord(level);
        for (var s = 0; s < levelSizes[level].length; s++) {
            setStyledRecord(frame, record, levelSizes[level][s]);
            if (frameFitsZone(frame, zone)) return true;
        }
    }

    // 2. 专色过多时允许两行。
    var multilineRecord = buildHotStampColorRecordMultiline();
    var multilineSizes = [6.5, 6, 5.5, 5, 4.5, 4, 3.5];
    for (var i = 0; i < multilineSizes.length; i++) {
        setStyledRecord(frame, multilineRecord, multilineSizes[i]);
        if (frameFitsZone(frame, zone)) return true;
    }

    // 3. 真正空间不足时，所有专色名/中文标签全部省略，只保留 C M Y K。
    var minimalSpaced = buildHotStampMinimalColorRecord(false);
    var minimalSizes = [6.5, 6, 5.5, 5, 4.5, 4, 3.5, 3];
    for (var m = 0; m < minimalSizes.length; m++) {
        setStyledRecord(frame, minimalSpaced, minimalSizes[m]);
        if (frameFitsZone(frame, zone)) return true;
    }

    // 4. 最窄区域再压成 CMYK（无空格），这是冷烫信息的最后保底项。
    var minimalTight = buildHotStampMinimalColorRecord(true);
    var tightSizes = [5, 4.5, 4, 3.5, 3, 2.5];
    for (var t = 0; t < tightSizes.length; t++) {
        setStyledRecord(frame, minimalTight, tightSizes[t]);
        if (frameFitsZone(frame, zone)) return true;
    }

    // 仍然放不下说明版面小到 CMYK 本身都无法安全落位。
    return false;
}

function placeMinimalCMYK(frame, preferredZone, hAlign, vAlign) {
    var minimalRecord = buildHotStampMinimalColorRecord(true);
    var sizes = [3, 2.5, 2, 1.75, 1.5];
    hAlign = hAlign || "left";
    vAlign = vAlign || "center";

    if (!preferredZone || zoneWidth(preferredZone) <= 0 || zoneHeight(preferredZone) <= 0) return false;
    for (var i = 0; i < sizes.length; i++) {
        setStyledRecord(frame, minimalRecord, sizes[i]);
        if (frameFitsZone(frame, preferredZone)
            && placeFrameInZone(frame, preferredZone, hAlign, vAlign)) {
            return true;
        }
    }
    return false;
}

function createHotStampColorInfo() {
    // 冷烫模式固定使用左下角信息区，并随长边方向旋转。
    // CMYK 是唯一强制保留项；中文色名和专色名称放不下时可逐级省略。
    var layout = getHotStampInfoLayout();
    var colorLayout = layout.color;

    var frame = textGroup.textFrames.add();
    frame.name = "hotStampColorInformationText";
    setStyledRecord(frame, buildHotStampColorRecord(0), fontSize);
    frame.position = [0, 0];
    rotateHotStampInfoFrame(frame, layout.rotation);

    var colorInfoFits = fitHotStampColorInfo(frame, colorLayout.zone);
    if (colorInfoFits) {
        // 重要：fitHotStampColorInfo() 可能最终选到 2.5pt。
        // 旧版在定位失败后错误地把它重新放大到 3pt，造成“明明能 fit 却报 CMYK 放不下”的假警告。
        // 这里保留已经选中的内容和字号直接定位。
        if (placeFrameInZone(frame, colorLayout.zone, colorLayout.hAlign, colorLayout.vAlign)) return;
    }

    // 最终只保留 CMYK，并继续限制在左下外围标识区内。
    // 不弹窗；其它信息本就允许省略，批量生成不应被正常降级打断。
    if (!placeMinimalCMYK(frame, colorLayout.zone, colorLayout.hAlign, colorLayout.vAlign)) {
        addLayoutWarning("极端小版面：CMYK 标识也无法在左下外围标识区安全放置，已省略。 ");
        frame.remove();
    }
}

// 文档信息入口：冷烫外侧模式使用新布局，其余情况完全沿用 v0.7.2
function createText () {
    if (hotStampingMark.value && !direction.value) {
        createHotStampText();
    } else {
        createTextLegacy();
    }
}

// 分色信息入口：冷烫外侧模式使用角部剩余空间，其余情况沿用 v0.7.2
function colorname() {
    if (hotStampingMark.value && !direction.value) {
        createHotStampColorInfo();
    } else {
        colornameLegacy();
    }
}

// 创建文档信息
function createTextLegacy () {
    
    var documentInformationTextX, documentInformationTextY,
        dimensionInformationTextX, dimensionInformationTextY, rotationAngle;

    // 画板文档信息
    var documentInformationTextFrame = textGroup.textFrames.add();
    documentInformationTextFrame.name = "documentInformationText";
    documentInformationTextFrame.contents = documentInformationTextContent;
    documentInformationTextFrame.textRange.characterAttributes.size = fontSize;
    documentInformationTextFrame.textRange.characterAttributes.textFont = infoTextFont;
    documentInformationTextFrame.textRange.characterAttributes.fillColor = processColors;

    var dimensionInformationTextContentFrame = textGroup.textFrames.add();
    dimensionInformationTextContentFrame.name = "dimensionInformationText";
    dimensionInformationTextContentFrame.contents = dimensionInformationTextContent;
    dimensionInformationTextContentFrame.textRange.characterAttributes.size = fontSize;
    dimensionInformationTextContentFrame.textRange.characterAttributes.textFont = infoTextFont;
    dimensionInformationTextContentFrame.textRange.characterAttributes.fillColor = processColors;

    textHeight = documentInformationTextFrame.textRange.characterAttributes.size * 0.3528 * pointTomm;
    var textWidth = documentInformationTextFrame.width;
    var dimensionInformationTextWidth = dimensionInformationTextContentFrame.width;
    if (pw > ph) {
        // 宽度大于高度，在底部左下角添加文字
        if(direction.value) {
            if (hotStampingMark.value) {
                documentInformationTextY = bottom;
                dimensionInformationTextY = bottom;
            } else {
                documentInformationTextY = bottom;
                dimensionInformationTextY = bottom;
            }
            documentInformationTextX = right - textWidth - dimensionInformationTextWidth;
            dimensionInformationTextX = right - dimensionInformationTextWidth;
        } else {
            if (hotStampingMark.value) {
                documentInformationTextY = bottom - markOffset - markArea;
                dimensionInformationTextY = bottom - markOffset - markArea;
            } else {
                documentInformationTextY = bottom - markOffset;
                dimensionInformationTextY = bottom - markOffset;
            }
            documentInformationTextX = right - textWidth - markArea - dimensionInformationTextWidth;
            dimensionInformationTextX = right - markArea - dimensionInformationTextWidth;
        }
        rotationAngle = 0;
    } else {
        // 宽度小于高度，在左下角添加文字
        if(direction.value) {
            if (hotStampingMark.value) {
                documentInformationTextX = left;
                dimensionInformationTextX = left;
            } else {
                documentInformationTextX = left;
                dimensionInformationTextX = left;
            }
            documentInformationTextY = bottom + textWidth + dimensionInformationTextWidth;
            dimensionInformationTextY = bottom + dimensionInformationTextWidth;
        } else {
            if (hotStampingMark.value) {
                documentInformationTextX = left - markOffset - markArea;
                dimensionInformationTextX = left - markOffset - markArea;
            } else {
                documentInformationTextX = left - markOffset;
                dimensionInformationTextX = left - markOffset;
            }
            documentInformationTextY = bottom + markArea * 2 + textWidth + dimensionInformationTextWidth;
            dimensionInformationTextY = bottom + markArea * 2 + dimensionInformationTextWidth;
        }
        rotationAngle = 270;
    }
    // 设置文字的位置
    documentInformationTextFrame.position = [documentInformationTextX, documentInformationTextY];
    dimensionInformationTextContentFrame.position = [dimensionInformationTextX, dimensionInformationTextY];
    // 确保旋转后位置不变
    if (rotationAngle !== 0) {
        documentInformationTextFrame.rotate(rotationAngle, true, true, true, true, Transformation.TOPLEFT);
        dimensionInformationTextContentFrame.rotate(rotationAngle, true, true, true, true, Transformation.TOPLEFT);
    }
    // 轮廓操作
//~     dimensionInformationTextFrame.createOutline();
}
// 创建分色信息
function colornameLegacy() {
    var textRef = textGroup.textFrames.add();
    var rotationAngle = 0;
    if (documentMonochrome.isMonochrome) {
        textRef.contents = "单色(COLOUR)";
    } else {
        textRef.contents = "青色(C) 洋红(M) 黄色(Y) 黑色(K) ";
    }
    textRef.textRange.characterAttributes.size = fontSize;
    textRef.textRange.characterAttributes.textFont = infoTextFont;
    var textWidth = textRef.width;
    if (pw > ph) {
        if(direction.value) {
            if (hotStampingMark.value) {
                textRef.top = y;
            } else {
                textRef.top = y;
            }
            textRef.left = x;
        } else {
            if (hotStampingMark.value) {
                textRef.top = y - markOffset - markArea;
            } else {
                textRef.top = y - markOffset;
            }
            textRef.left = x + markArea;
        }
        rotationAngle = 0;
    } else {
        if(direction.value) {
            if (hotStampingMark.value) {
                textRef.left = x;
            } else {
                textRef.left = x;
            }
            textRef.top = y + ph;
        } else {
            if (hotStampingMark.value) {
                textRef.left = x - markOffset - markArea;
            } else {
                textRef.left = x - markOffset;
            }
            textRef.top = y + ph - markArea;
        }

        rotationAngle = 270;
    }
    var spotColor = new SpotColor();
    if (documentMonochrome.isMonochrome) {
        if (spotColorInfo.length > 0) {
            for (var h = 0; h < spotColorInfo.length; h++) {
                if (spotColorBeingUsedSet[getColorString(spotColorInfo[h])]) {
                    spotColor.spot = doc.spots.getByName(spotColorInfo[h].name);
                    spotColor.tint = 100;
                    textRef.textRange.characterAttributes.fillColor = spotColor;
                } else {
                    // 如果没有对应的专色，那么就是普通色
                    textRef.textRange.characterAttributes.fillColor = documentMonochrome.color;
                }
            }
        } else {
            // 如果没有专色，直接普通色
            textRef.textRange.characterAttributes.fillColor = documentMonochrome.color;
        }
    } else {
        for (var i = 0; i <= 5; i += 1) {
            textRef.textRange.characters[i].characterAttributes.fillColor = mCMYK[0];
        }
        for (var i = 6; i <= 11; i += 1) {
            textRef.textRange.characters[i].characterAttributes.fillColor = mCMYK[1];
        }
        for (var i = 12; i <= 17; i += 1) {
            textRef.textRange.characters[i].characterAttributes.fillColor = mCMYK[2];
        }
        for (var i = 18; i <= 22; i += 1) {
            textRef.textRange.characters[i].characterAttributes.fillColor = mCMYK[3];
        }
    }
    if (rotationAngle !== 0) {
        textRef.rotate(rotationAngle, true, true, true, true, Transformation.TOPLEFT);
    }
    textHeight = textRef.textRange.characterAttributes.size * 0.3528 * pointTomm;
    
    if (!documentMonochrome.isMonochrome) {
        if (spotColorInfo.length > 0) {
            var widthPreviousText = 0;
            for (var h = 0; h < spotColorInfo.length; h++) {
                if (spotColorBeingUsedSet[getColorString(spotColorInfo[h])]) {
                    spotColor.spot = doc.spots.getByName(spotColorInfo[h].name);
                    spotColor.tint = 100;
                    var spotNametextRef = textGroup.textFrames.add();
                    spotNametextRef.contents = "(" + spotColorInfo[h].name + ") ";
                    spotNametextRef.textRange.characterAttributes.size = fontSize;
                    spotNametextRef.textRange.characterAttributes.textFont = infoTextFont;
                    spotNametextRef.textRange.characterAttributes.fillColor = spotColor;
                    if (pw > ph) {
                        if(direction.value) {
                            if (hotStampingMark.value) {
                                spotNametextRef.top = y;
                            } else {
                                spotNametextRef.top = y - reticleLength;
                            }
                            spotNametextRef.left = x + textWidth + widthPreviousText;
                        } else {
                            if (hotStampingMark.value) {
                                spotNametextRef.top = y - markOffset - markArea;
                            } else {
                                spotNametextRef.top = y - markOffset / 2 - reticleLength;
                            }
                            spotNametextRef.left = x + markArea + textWidth + widthPreviousText;
                        }
                        rotationAngle = 0;
                    } else {
                        if(direction.value) {
                            if (hotStampingMark.value) {
                                spotNametextRef.left = x;
                            } else {
                                spotNametextRef.left = x - reticleLength;
                            }
                            spotNametextRef.top = y + ph - textWidth - widthPreviousText;
                        } else {
                            if (hotStampingMark.value) {
                                spotNametextRef.left = x - markOffset - markArea;
                            } else {
                                spotNametextRef.left = x - markOffset / 2 - reticleLength;
                            }
                            spotNametextRef.top = y + ph - markArea - textWidth - widthPreviousText;
                        }
                        rotationAngle = 270;
                    }
                    widthPreviousText = spotNametextRef.width;
                    if (rotationAngle !== 0) {
                        spotNametextRef.rotate(rotationAngle, true, true, true, true, Transformation.TOPLEFT);
                    }
                }
            }
        }
    }
}
// 获取分色信息
function getSpotColorInfo(spotColor) {
    return {
      color: spotColor.color,
      name: spotColor.name,
      kind: spotColor.spotKind,
      typename: spotColor.typename,
      colorType: spotColor.color.typename,
      cyan: spotColor.color.cyan,
      magenta: spotColor.color.magenta,
      yellow: spotColor.color.yellow,
      black: spotColor.color.black,
    };
}
// 获取图层
function getLayerByName(name) {
    var layers = doc.layers;
    for (var i = 0; i < layers.length; i++) {
        if (layers[i].name === name) {
            return layers[i];
        }
    }
    return null;
}

function getLayerWriteIssue(layer) {
    if (!layer) return "";
    if (!layer.visible) return "图层“" + layer.name + "”当前不可见。";
    if (layer.locked) return "图层“" + layer.name + "”当前已锁定。";
    return "";
}

function restoreDocumentContext(documentRef, activeLayer, activeArtboardIndex) {
    try {
        if (documentRef.artboards.length > 0) {
            documentRef.artboards.setActiveArtboardIndex(activeArtboardIndex);
        }
    } catch (e) {
        logRuntimeWarning("无法恢复原活动画板：" + e.message);
    }
    try {
        if (activeLayer) documentRef.activeLayer = activeLayer;
    } catch (e) {
        logRuntimeWarning("无法恢复原活动图层：" + e.message);
    }
}
// 获取尺寸信息
// 始终显示最终纸张/输出范围尺寸：
// - 普通画板 + 自适应画板：显示扩展后的尺寸；
// - 冷烫模式：显示包含外围标记后的尺寸（白墨不参与尺寸计算）；
// - 选中对象生成标记：即使画板不扩展，也显示对象 + 外围标记所需纸张尺寸。
function pagesize() {
    var outputSize = getOutputSizePoints();
    var widthPt = outputSize.width;
    var heightPt = outputSize.height;
    var sizeUnit = "MM";
    var sizeX = widthPt;
    var sizeY = heightPt;
    switch (doc.rulerUnits) {
        case RulerUnits.Centimeters:
            sizeUnit = " 厘米 ";
            sizeX = Math.round(((widthPt / pointTomm) / 10) * 100) / 100;
            sizeY = Math.round(((heightPt / pointTomm) / 10) * 100) / 100;
            break;
        case RulerUnits.Inches:
            sizeUnit = " 英吋 ";
            sizeX = Math.round((widthPt / 72) * 100) / 100;
            sizeY = Math.round((heightPt / 72) * 100) / 100;
            break;
        case RulerUnits.Millimeters:
            sizeUnit = " 毫米 ";
            sizeX = Math.round(((widthPt / pointTomm) + 0.001) * 100) / 100;
            sizeY = Math.round(((heightPt / pointTomm) + 0.001) * 100) / 100;
            break;
        case RulerUnits.Points:
            sizeUnit = " 点 ";
            sizeX = Math.round(widthPt * 100) / 100;
            sizeY = Math.round(heightPt * 100) / 100;
            break;
        case RulerUnits.Pixels:
            sizeUnit = " 像素 ";
            sizeX = Math.round(widthPt * 100) / 100;
            sizeY = Math.round(heightPt * 100) / 100;
            break;
        case RulerUnits.Qs:
            sizeUnit = " Ha ";
            sizeX = Math.round(widthPt * 141.111) / 100;
            sizeY = Math.round(heightPt * 141.111) / 100;
            break;
    }
    return " 尺寸 : " + sizeX + "X" + sizeY + sizeUnit;
}
// 获取时间
function filenameDate() {
    var today = new Date();
    // 获取年、月、日
    var year = today.getFullYear();
    var month = today.getMonth() + 1;
    var day = today.getDate();
    return " 日期 : " + year + "-" + month+ "-" + day;
}
// 创建颜色
function createCMYKColor(c, m, y, k) {
    var color = new CMYKColor();
    color.cyan = c;
    color.magenta = m;
    color.yellow = y;
    color.black = k;
    return color;
}
// 修改文字内容
function modifyTextFrame(group, textName, newText) {
    if (group.textFrames.length > 0) {
        for (var i = 0; i < group.textFrames.length; i++) {
            var textFrame = group.textFrames[i];
            if (textFrame.name === textName) {
                textFrame.contents = newText;
                break;
            }
        }
    }
}
// 判断是否为单色
function isDocumentMonochrome() {
    var colorSet = {};
    var colorCount = 0;
    var monochromeColor = processColors;
    if (params.verifyWhetherDocumentMonochrome) {
        for (var i = 0, len = doc.pathItems.length; i < len; i++) {
            var item = doc.pathItems[i];
            // 填充颜色
            if (item.filled && item.fillColor.typename !== "NoColor") {
                var fillColor = getColorString(item.fillColor);
                // 如果颜色不存在于 colorSet 中，则添加并计数
                if (!colorSet[fillColor]) {
                    colorSet[fillColor] = true;
                    colorCount++;
                    monochromeColor = item.fillColor;
                    if (item.fillColor.typename === "SpotColor") {
                        // 判断是否套版色
                        if (ColorModel.REGISTRATION !== item.fillColor.spot.colorType) {
                            spotColorBeingUsedSet[fillColor] = true;
                        } else {
                            colorSet[fillColor] = false;
                            colorCount--;
                            monochromeColor = processColors;
                        }
                    }
                }
            }
            // 描边颜色
            if (item.stroked && item.strokeColor.typename !== "NoColor") {
                var strokeColor = getColorString(item.strokeColor);
                // 如果颜色不存在于 colorSet 中，则添加并计数
                if (!colorSet[strokeColor]) {
                    colorSet[strokeColor] = true;
                    colorCount++;
                    monochromeColor = item.strokeColor;
                    if (item.strokeColor.typename === "SpotColor") {
                        // 判断是否套版色
                        if (ColorModel.REGISTRATION !== item.strokeColor.spot.colorType) {
                            spotColorBeingUsedSet[strokeColor] = true;
                        } else {
                            colorSet[strokeColor] = false;
                            colorCount--;
                            monochromeColor = processColors;
                        }
                    }
                }
            }
        }
        if (colorCount > 1) {
            return { isMonochrome: false, color: null };
        } else {
            return { isMonochrome: true, color: monochromeColor };
        }
    }
    return { isMonochrome: false, color: null };
}
// 返回色彩字符串
function getColorString(color) {
    if (color.typename === "RGBColor") {
        return "RGB(" + color.red + "," + color.green + "," + color.blue + ")";
    } else if (color.typename === "CMYKColor") {
        return "CMYK(" + color.cyan + "," + color.magenta + "," + color.yellow + "," + color.black + ")";
    } else if (color.typename === "GrayColor") {
        return "Gray(" + color.gray + ")";
    } else if (color.typename === "SpotColor") {
        return "SPOT(" + color.spot.color.cyan + "," + color.spot.color.magenta + "," + color.spot.color.yellow + "," + color.spot.color.black + ")";
    } else if (color.typename === "Spot") {
        return "SPOT(" + color.color.cyan + "," + color.color.magenta + "," + color.color.yellow + "," + color.color.black + ")";
    } else {
        return "OtherColor";
    }
}
// 判断专色是否存在的函数
function spotColorExists(name) {
    var swatches = app.activeDocument.swatches;
    for (var i = 0; i < swatches.length; i++) {
        var swatch = swatches[i];
        if (swatch.color.typename === "SpotColor" && swatch.name === name) {
            return true;
        }
    }
    return false;
}
function getBounds(obj) {
    var selObj1 = new Array();
    var selObj2 = new Array();
    var vgb1 = new Array();
    var vgb2 = new Array();
    var n = obj.length;
    if (n > 0) {
        if (obj[0].typename == "GroupItem" && obj[0].clipped && obj[0].pageItems.length > 1) {
            var clipObj = obj[0].pathItems[0].geometricBounds;
            vgb1 = clipObj;
        } else {
            selObj1 = obj[0];
            if (cb6.value) {
                vgb1 = selObj1.visibleBounds;
            } else {
                vgb1 = selObj1.geometricBounds;
            }
        }
        if (n > 1) {
            for (var i = 1; i < n; i += 1) {
                selObj2 = obj[i];
                if (obj[i].typename == "GroupItem" && obj[i].clipped && obj[i].pageItems.length > 1) {
                    if (cb6.value) {
                        vgb2 = obj[i].pathItems[0].visibleBounds;
                    } else {
                        vgb2 = obj[i].pathItems[0].geometricBounds;
                    }
                } else {
                    if (cb6.value) {
                        vgb2 = selObj2.visibleBounds;
                    } else {
                        vgb2 = selObj2.geometricBounds;
                    }
                }
                if (vgb1[0] > vgb2[0]) {
                    vgb1[0] = vgb2[0]
                }
                if (vgb1[1] < vgb2[1]) {
                    vgb1[1] = vgb2[1]
                }
                if (vgb1[2] < vgb2[2]) {
                    vgb1[2] = vgb2[2]
                }
                if (vgb1[3] > vgb2[3]) {
                    vgb1[3] = vgb2[3]
                }
            }
        }
    }
    return vgb1;
}
