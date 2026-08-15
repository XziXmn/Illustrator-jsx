
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
            "\r": "\\r",
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
    dialog.text = "云漫标记集 Ver 0.7.1"; 
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
    markRadiusMMInput.helpTip = "单位毫米"; 
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
    offsetMMInput.helpTip = "单位毫米"; 
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
    whiteInkLayer.helpTip = "是否添加白墨层，默认为添加。"; 
    whiteInkLayer.text = "添加白墨图层"; 

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

if (app.activeDocument.selection.length > 0) {
    dialog.text = dialog.text + "（已选中对象）";
    AdaptiveArtboard.enabled = false;
    AdaptiveArtboard.value = false;
    hotStampingMark.value = false;
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

FileInformation.onClick = function () {
    FileInformation.value ? Comment_text.enabled = true : Comment_text.enabled = false
}
Bisector.onClick = function () {
    Bisector.value ? Panel_3.enabled = true : Panel_3.enabled = false
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

var params = {
    "verifyWhetherDocumentMonochrome" : false
}
if (storageFile.exists) {
    storageFile.open("r");
    var savedParams = JSON.parse(storageFile.read());
    storageFile.close();
    // 更新参数
    lineWidthInput.enabled = savedParams.lineWidthInputEnabled;
    params.verifyWhetherDocumentMonochrome = savedParams.verifyWhetherDocumentMonochrome;
}
// 确定按钮事件
ok.onClick = function() {
    if (markRadiusMMInput.text <= 5 || offsetMMInput.text <= 0 || isNaN(offsetMMInput.text) == true || isNaN(markRadiusMMInput.text) == true) {
        alert("输入的标记大小必须大于5mm且偏移大于0mm！", "错误");
    } else {
        dialog.close(true);
    }
}

dialog.center();
myReturn = dialog.show();
if (myReturn == true) {
    var aiver = app.version;
    var pointTomm = 2.83464566929134;
    var markArea = markRadiusMMInput.text * pointTomm; // 用户输入的大小
    var markOffset = direction.value ? -((eval(markRadiusMMInput.text) + eval(offsetMMInput.text)) * pointTomm) : offsetMMInput.text * pointTomm; // 用户输入标记与画板间距
    var strokeWidth = lineWidthInput.text * pointTomm; // 整体描边线条宽度
    var registrationMarkWidth = lineWidthInput.text * pointTomm; // 套准标记线条宽度
    var markSpacing = 35 * pointTomm; // 相邻标记间隔 设计为边的百分比大小
    var markRadius = markArea / 2; // 角线十字圆半径
    var reticleLength = markArea / 2; // 标记里十字线从相交点出发每端延伸的长度
    var firstInterval = 8 * pointTomm; // 首尾偏移余量
    var margin = markArea * 0.03; // 白底宽度余量
    var stripWidth = markArea + margin; // 白底色块宽度
    var compensation = markOffset + markRadius * 2; // 宽度补偿

    var documentColorSpace, documentMonochrome;
    var fonts = app.textFonts; // 字体信息
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

    var spotColorBeingUsedSet = {}; // 文档中使用的专色信息
    var spotColorInfo = []; // 文档中存在的专色信息

    // 等分线参数
    var hBisector = eval(horizontalDirection.text);
    var vBisector = eval(verticalDirection.text);
    var hBSpace = eval(spacing_1.text) * pointTomm;
    var vBSpace = eval(spacing_2.text) * pointTomm;
    var mCMYK = [createCMYKColor(100, 0, 0, 0), createCMYKColor(0, 100, 0, 0), createCMYKColor(0, 0, 100, 0), createCMYKColor(0, 0, 0, 100)];
    
    // 获取文档颜色模式
    documentColorSpace = doc.documentColorSpace;
    for (var i = 0, len = doc.spots.length; i < len; i++) {
        // 套版色不存入
        if ("[套版色]" != doc.spots[i].name) {
            spotColorInfo.push(getSpotColorInfo(doc.spots[i]));
        }
    }

    var markLayerName = "标记图层"
    var markLayer = getLayerByName(markLayerName);
    if (!markLayer) {
        markLayer = doc.layers.add();
        markLayer.name = markLayerName;
    }
    doc.activeLayer = markLayer;

    // 获取文档中的套版色
    var processColors = doc.swatches[1].color;
    // 调用单色判断,该方法一并将专色使用情况存储下来
    documentMonochrome = isDocumentMonochrome();

    if (doc.selection.length > 0) {
        var obj = doc.selection;
        var selVB = getBounds(obj);
        var docName = "文件名: " + doc.name;
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
            artboard = doc.artboards[j];
            doc.artboards.setActiveArtboardIndex(j);
            var rect = artboard.artboardRect;
            var artboardnumber = doc.artboards.getActiveArtboardIndex() + 1;
            var docName = "文件名: " + doc.name + "  页码: " + doc.artboards.length + "-" + artboardnumber;
            left = rect[0]; //左
            top = rect[1]; // 上
            right = rect[2]; // 右
            bottom = rect[3]; // 下
            pw = doc.width;
            ph = doc.height;
            x = doc.cropBox[0];
            y = doc.cropBox[1] - ph;
            main();
        }
    } else {
        pw = doc.width;
        ph = doc.height;
        var docName = "文件名: " + doc.name;
        main();
    }

    params.verifyWhetherDocumentMonochrome = params.verifyWhetherDocumentMonochrome;
    params.lineWidthInputEnabled = lineWidthInput.enabled;

    // 保存参数到本地文件
    storageFile.open("w");
    storageFile.write(JSON.stringify(params));
    storageFile.close();
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
    
    if (whiteInkLayer.value) {
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
        if (whiteInkLayer.value) {
            rect[0] -= markOffset + stripWidth; // 左边
            rect[3] -= markOffset + stripWidth; // 下边
            rect[1] += markOffset + stripWidth; // 上边
            rect[2] += markOffset + stripWidth; // 右边
            if (FileInformation.value || PrintingColorSeparation.value) {
                if (hotStampingMark.value) {
                    if (right - left > top - bottom) {
                        rect[3] -= textHeight; // 下边
                    } else {
                        rect[0] -= textHeight; // 左边
                    }
                }
            }
        } else {
            rect[0] -= markOffset + markArea; // 左边
            rect[3] -= markOffset + markArea; // 下边
            rect[1] += markOffset + markArea; // 上边
            rect[2] += markOffset + markArea; // 右边
            if (FileInformation.value || PrintingColorSeparation.value) {
                if (hotStampingMark.value) {
                    if (right - left > top - bottom) {
                        rect[3] -= textHeight; // 下边
                    } else {
                        rect[0] -= textHeight; // 左边
                    }
                }
            }

        }
        // 设置新的画板尺寸
        artboard.artboardRect = rect;
        pw = doc.width;
        ph = doc.height;
        modifyTextFrame(textGroup, "dimensionInformationText", pagesize());
    }

}
// 创建识别标识
function createMark() {
    // 标记数量
    var maxNumber = 6;
    // 添加顶部边缘的标记，按照从左到右的顺序
    var numberCounter = 1;
    for (var x = left + firstInterval + markArea; x < right - markArea; x += markSpacing) {
        if (x !== left && x !== right - markArea) {
            createMarkWithNumber("BandOne", x, top + markOffset + reticleLength, numberCounter, topMarksGroup, processColors);
            numberCounter = (numberCounter % maxNumber) + 1;
        }
    }
    // 添加底部边缘的标记，按照从右到左的顺序
    numberCounter = 1;
    for (var x = right - firstInterval - markArea; x > left + markArea; x -= markSpacing) {
        if (x !== left && x !== right - markArea) {
            createMarkWithNumber("BandOne", x, bottom - markOffset - reticleLength, numberCounter, bottomMarksGroup, processColors);
            numberCounter = (numberCounter % maxNumber) + 1;
        }
    }
    // 添加右侧边缘的标记，按照从上到下的顺序
    numberCounter = 1;
    for (var y = top - firstInterval - markArea; y > bottom + markArea; y -= markSpacing) {
        if (y !== top && y !== bottom + markArea) {
            createMarkWithNumber("Secondset", right + markOffset + reticleLength, y, numberCounter, rightMarksGroup, processColors);
            numberCounter = (numberCounter % maxNumber) + 1;
        }
    }
    // 添加左侧边缘的标记，按照从下到上的顺序
    numberCounter = 1;
    for (var y = bottom + firstInterval + markArea; y < top - markArea; y += markSpacing) {
        if (y !== top && y !== bottom + markArea) {
            createMarkWithNumber("Secondset", left - markOffset - reticleLength, y, numberCounter, leftMarksGroup, processColors);
            numberCounter = (numberCounter % maxNumber) + 1;
        }
    }
    // 居中
    horizontallyCenterGroupToArtboard(topMarksGroup);
    horizontallyCenterGroupToArtboard(bottomMarksGroup);
    verticallyCenterGroupToArtboard(rightMarksGroup);
    verticallyCenterGroupToArtboard(leftMarksGroup);
}
// 辅助函数用于生成各样标记
function createMarkWithNumber(g, x, y, number, group, color) {
    switch (g) {
        case "BandOne" :
            switch (number) {
                case 1:
                    createSquareReticle(x, y, reticleLength * 0.88, reticleLength, group, color);
                    break;
                case 2:
                    createRectangularReticle(x, y, reticleLength, reticleLength * 0.51, reticleLength, 0, group, color);
                    break;
                case 3:
                    createCrosshairFourSideRightAngleShape(x, y, reticleLength * 0.33 , reticleLength * 0.85, reticleLength, group, color); 
                    break;
                case 4:
                    createRectangularReticle(x, y, reticleLength * 0.51, reticleLength, reticleLength, 45, group, color);
                    break;
                case 5:
                    createRectangularReticle(x, y, reticleLength * 0.51, reticleLength, reticleLength, 0, group, color);
                    break;
                case 6:
                    createRectangularReticle(x, y, reticleLength * 0.51, reticleLength, reticleLength, 135, group, color);
                    break;
                default:
                    alert("生成失败！")
                    break;
            }
            break;
        case "Secondset" :
            switch (number) {
                case 1:
                    createCircularReticle(x, y, (markArea / 4), reticleLength, group, color);
                    break;
                case 2:
                    createOvalReticle(x, y, markArea * 0.75, markArea / 2, reticleLength, 0, group, color);
                    break;
                case 3:
                    createCircularReticleFourSidesArc(x, y, reticleLength * 0.33, reticleLength, group, color);
                    break;
                case 4:
                    createOvalReticle(x, y, markArea / 2, markArea * 0.75, reticleLength, 0, group, color);
                    break;
                case 5: 
                    createOvalReticle(x, y, markArea * 0.75, markArea / 2, reticleLength, 45, group, color);
                    break;
                case 6:
                    createOvalReticle(x, y, markArea * 0.75, markArea / 2, reticleLength, 135, group, color);
                    break;
                default:
                    alert("生成失败！")
                    break;
            }
            break;
        default:
            alert("类型错误！")
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
// 椭圆十字线
function createOvalReticle(x, y, ellipseWidth, ellipseHeight, length, angle, group, color) {
    
    var oval = group.pathItems.ellipse(y + ellipseHeight / 2, x - ellipseWidth / 2, ellipseWidth, ellipseHeight);

    var verticalLine = group.pathItems.add();
    verticalLine.setEntirePath([[x, y - length], [x, y + length]]);

    var horizontalLine = group.pathItems.add();
    horizontalLine.setEntirePath([[x - length, y], [x + length, y]]);

    oval.stroked = true;
    oval.strokeWidth = registrationMarkWidth;
    oval.filled = false;
    oval.strokeColor = color;

    verticalLine.stroked = true;
    verticalLine.filled = false;
    verticalLine.strokeWidth = registrationMarkWidth;
    verticalLine.strokeColor = color;

    horizontalLine.stroked = true;
    horizontalLine.filled = false;
    horizontalLine.strokeWidth = registrationMarkWidth;
    horizontalLine.strokeColor = color;

    if (angle != 0) {
        oval.rotate(angle, true, true, true, true, Transformation.CENTER);
    }
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
// 十字线四边直角形状
function createCrosshairFourSideRightAngleShape(x, y, offset, fourSidesLength, length, group, color) {

    // 绘制垂直线（穿过中心点）
    var verticalLine =group.pathItems.add();
    verticalLine.setEntirePath([[x, y - length], [x, y + length]]);

    // 绘制水平线（穿过中心点）
    var horizontalLine = group.pathItems.add();
    horizontalLine.setEntirePath([[x - length, y], [x + length, y]]);
    
    // 绘制左上角
    var topLeftCorner = group.pathItems.add();
    topLeftCorner.setEntirePath([[x - fourSidesLength, y + offset], [x - offset, y + offset], [x - offset, y + fourSidesLength]]);
    
    // 绘制右上角
    var topRightCorner = group.pathItems.add();
    topRightCorner.setEntirePath([[x + offset, y + fourSidesLength], [x + offset, y + offset], [x + fourSidesLength, y + offset]]);

    // 绘制左下角
    var bottomLeftCorner = group.pathItems.add();
    bottomLeftCorner.setEntirePath([[x - offset, y - fourSidesLength], [x - offset, y - offset], [x - fourSidesLength, y - offset]]);

    // 绘制右下角垂直线
    var bottomRightCorner = group.pathItems.add();
    bottomRightCorner.setEntirePath([[x + offset, y - fourSidesLength], [x + offset, y - offset], [x + fourSidesLength, y - offset]]);

    verticalLine.stroked = true;
    verticalLine.filled = false;
    verticalLine.strokeWidth = registrationMarkWidth;
    verticalLine.strokeColor = color;

    horizontalLine.stroked = true;
    horizontalLine.filled = false;
    horizontalLine.strokeWidth = registrationMarkWidth;
    horizontalLine.strokeColor = color;

    topLeftCorner.stroked = true;
    topLeftCorner.filled = false;
    topLeftCorner.strokeWidth = registrationMarkWidth;
    topLeftCorner.strokeColor = color;

    topRightCorner.stroked = true;
    topRightCorner.filled = false;
    topRightCorner.strokeWidth = registrationMarkWidth;
    topRightCorner.strokeColor = color;

    bottomLeftCorner.stroked = true;
    bottomLeftCorner.filled = false;
    bottomLeftCorner.strokeWidth = registrationMarkWidth;
    bottomLeftCorner.strokeColor = color;

    bottomRightCorner.stroked = true;
    bottomRightCorner.filled = false;
    bottomRightCorner.strokeWidth = registrationMarkWidth;
    bottomRightCorner.strokeColor = color;
}
// 绘制正方形十字线
function createSquareReticle(x, y, squareSize, length, group, color) {
    
    // 计算正方形左上角的坐标
    var left = x - (squareSize / 2);
    var top = y + (squareSize / 2);

    // 绘制正方形
    var square = group.pathItems.rectangle(top, left, squareSize, squareSize);

    // 绘制垂直线（穿过中心点）
    var verticalLine = group.pathItems.add();
    verticalLine.setEntirePath([[x, y - length], [x, y + length]]);

    // 绘制水平线（穿过中心点）
    var horizontalLine = group.pathItems.add();
    horizontalLine.setEntirePath([[x - length, y], [x + length, y]]);

    verticalLine.stroked = true;
    verticalLine.filled = false;
    verticalLine.strokeWidth = registrationMarkWidth;
    verticalLine.strokeColor = color;

    horizontalLine.stroked = true;
    horizontalLine.filled = false;
    horizontalLine.strokeWidth = registrationMarkWidth;
    horizontalLine.strokeColor = color;

    square.stroked = true;
    square.strokeWidth = registrationMarkWidth;
    square.filled = false;
    square.strokeColor = color;
}
// 绘制长方形十字线
function createRectangularReticle(x, y, width, height, length, angle, group, color) {

    // 计算正方形左上角的坐标
    var left = x - (width / 2);
    var top = y + (height / 2);

    // 绘制长方形
    var square = group.pathItems.rectangle(top, left, width, height);

    // 绘制垂直线（穿过中心点）
    var verticalLine = group.pathItems.add();
    verticalLine.setEntirePath([[x, y - length], [x, y + length]]);

    // 绘制水平线（穿过中心点）
    var horizontalLine = group.pathItems.add();
    horizontalLine.setEntirePath([[x - length, y], [x + length, y]]);
    
    verticalLine.stroked = true;
    verticalLine.filled = false;
    verticalLine.strokeWidth = registrationMarkWidth;
    verticalLine.strokeColor = color;

    horizontalLine.stroked = true;
    horizontalLine.filled = false;
    horizontalLine.strokeWidth = registrationMarkWidth;
    horizontalLine.strokeColor = color;

    square.stroked = true;
    square.strokeWidth = registrationMarkWidth;
    square.filled = false;
    square.strokeColor = color;
    
    if (angle != 0) {
        square.rotate(angle, true, true, true, true, Transformation.CENTER);
    }
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
function bisector() {
    var lineGroup = doc.groupItems.add();
    var lineGroup = regGroup.groupItems.add();
    if (vBSpace == 0) {
        for (var vML = 1; vML < vBisector; vML += 1) {
            var vEquidistant = ph / vBisector;
            var myLine1 = lineGroup.pathItems.add();
            myLine1.setEntirePath([
                [(x - markArea) - markOffset, y + (vML * vEquidistant)],
                [x - markOffset, y + (vML * vEquidistant)]
            ]);
            myLine1.filled = false;
            myLine1.stroked = true;
            myLine1.strokeWidth = strokeWidth;
            myLine1.strokeColor = processColors;
            myLine1.duplicate().left = x + pw + markOffset;
        }
    } else {
        for (var vML = 1; vML < vBisector; vML += 1) {
            var vEquidistant = (ph + vBSpace) / vBisector;
            var myLine1 = lineGroup.pathItems.add();
            myLine1.setEntirePath([
                [(x - markArea) - markOffset, y + (vML * vEquidistant)],
                [x - markOffset, y + (vML * vEquidistant)]
            ]);
            myLine1.filled = false;
            myLine1.stroked = true;
            myLine1.strokeWidth = strokeWidth;
            myLine1.strokeColor = processColors;
            var myLine2 = myLine1.duplicate();
            myLine2.position = [(x - markArea) - markOffset, (y - vBSpace) + (vML * vEquidistant)];
            myLine1.duplicate().left = x + pw + markOffset;
            myLine2.duplicate().left = x + pw + markOffset;
        }
    }
    if (hBSpace == 0) {
        for (var hML = 1; hML < hBisector; hML += 1) {
            var hEquidistant = pw / hBisector;
            var myLine3 = lineGroup.pathItems.add();
            myLine3.setEntirePath([
                [x + (hML * hEquidistant), y - (1.5 * markArea)],
                [x + (hML * hEquidistant), y - (0.5 * markArea)]
            ]);
            myLine3.filled = false;
            myLine3.stroked = true;
            myLine3.strokeWidth = strokeWidth;
            myLine3.strokeColor = processColors;
            myLine3.duplicate().top = y + ph + markOffset + markArea;
        }
    } else {
        for (var hML = 1; hML < hBisector; hML += 1) {
            var hEquidistant = (pw + hBSpace) / hBisector;
            var myLine3 = lineGroup.pathItems.add();
            myLine3.setEntirePath([
                [(x + (hML * hEquidistant)) - hBSpace, y - markOffset],
                [(x + (hML * hEquidistant)) - hBSpace, y - markArea - markOffset]
            ]);
            myLine3.filled = false;
            myLine3.stroked = true;
            myLine3.strokeWidth = strokeWidth;
            myLine3.strokeColor = processColors;
            var myLine4 = myLine3.duplicate();
            myLine4.position = [x + (hML * hEquidistant), y - markOffset];
            myLine4.duplicate().top = y + ph + markOffset + markArea;
            myLine3.duplicate().top = y + ph + markOffset + markArea;
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

    if (PrintingCornerLine.value) {

        // 上边左边
        createRectangle(rectangleGroup, left + margin, top + stripWidth + markOffset, (right - left) / 2 - (markArea + markOffset + margin), stripWidth, spotColor);
        // 上边右边
        createRectangle(rectangleGroup, left + (right - left) / 2 + (markArea + markOffset), top + stripWidth + markOffset, (right - left) / 2 - (markArea + markOffset + margin), stripWidth, spotColor);
        // 下边左边
        createRectangle(rectangleGroup, left + margin, bottom - markOffset, (right - left) / 2 - (markArea + markOffset + margin), stripWidth, spotColor);
        // 下边右边
        createRectangle(rectangleGroup, left + (right - left) / 2 + (markArea + markOffset), bottom - markOffset, (right - left) / 2 - (markArea + markOffset + margin), stripWidth, spotColor);
        // 左边上边
        createRectangle(rectangleGroup, left - stripWidth - markOffset, top - margin, stripWidth, (top - bottom) / 2 - (markArea + markOffset + margin), spotColor);
        // 左边下边
        createRectangle(rectangleGroup, left - stripWidth - markOffset, top - (top - bottom) / 2 - (markArea + markOffset), stripWidth, (top - bottom) / 2 - (markArea + markOffset + margin), spotColor);
        // 右边上边
        createRectangle(rectangleGroup, right + markOffset, top - margin, stripWidth, (top - bottom) / 2 - (markArea + markOffset + margin), spotColor);
        // 右边下边
        createRectangle(rectangleGroup, right + markOffset, top - (top - bottom) / 2 - (markArea + markOffset), stripWidth, (top - bottom) / 2 - (markArea + markOffset + margin), spotColor);
    } else {
        // 上边
        createRectangle(rectangleGroup, left + margin, top + stripWidth + markOffset, right - left - margin * 2, stripWidth, spotColor);
        // 下边
        createRectangle(rectangleGroup, left + margin, bottom - markOffset, right - left - margin * 2, stripWidth, spotColor);
        // 左边
        createRectangle(rectangleGroup, left - stripWidth - markOffset, top - margin, stripWidth, top - bottom - margin * 2, spotColor);
        // 右边
        createRectangle(rectangleGroup, right + markOffset, top - margin, stripWidth, top - bottom - margin * 2, spotColor);
    }

}
// 创建填充块
function createRectangle(rectangleGroup, x, y, rectWidth, rectHeight, color) {
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
// 创建文档信息
function createText () {
    
    var documentInformationTextX, documentInformationTextY,
        dimensionInformationTextX, dimensionInformationTextY, rotationAngle;

    // 画板文档信息
    var documentInformationTextFrame = textGroup.textFrames.add();
    documentInformationTextFrame.name = "documentInformationText";
    documentInformationTextFrame.contents = documentInformationTextContent;
    documentInformationTextFrame.textRange.characterAttributes.size = fontSize;
    documentInformationTextFrame.textRange.characterAttributes.textFont = fonts.getByName("MicrosoftYaHei");
    documentInformationTextFrame.textRange.characterAttributes.fillColor = processColors;

    var dimensionInformationTextContentFrame = textGroup.textFrames.add();
    dimensionInformationTextContentFrame.name = "dimensionInformationText";
    dimensionInformationTextContentFrame.contents = dimensionInformationTextContent;
    dimensionInformationTextContentFrame.textRange.characterAttributes.size = fontSize;
    dimensionInformationTextContentFrame.textRange.characterAttributes.textFont = fonts.getByName("MicrosoftYaHei");
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
function colorname() {
    var textRef = textGroup.textFrames.add();
    if (documentMonochrome.isMonochrome) {
        textRef.contents = "单色(COLOUR)";
    } else {
        textRef.contents = "青色(C) 洋红(M) 黄色(Y) 黑色(K) ";
    }
    textRef.textRange.characterAttributes.size = fontSize;
    textRef.textRange.characterAttributes.textFont = fonts.getByName("MicrosoftYaHei");
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
                    spotNametextRef.textRange.characterAttributes.textFont = fonts.getByName("MicrosoftYaHei");
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
            if (!layers[i].visible) {
                alert("图层不可见！", "错误")
            }
            return layers[i];
        }
    }
    return null;
}
// 获取尺寸信息
function pagesize() {
    var sizeUnit = "MM";
    var sizeX = pw;
    var sizeY = ph;
    switch (doc.rulerUnits) {
        case RulerUnits.Centimeters:
            sizeUnit = " 厘米 ";
            sizeX = Math.round(((pw / pointTomm) / 10) * 100) / 100;
            sizeY = Math.round(((ph / pointTomm) / 10) * 100) / 100;
            break;
        case RulerUnits.Inches:
            sizeUnit = " 英吋 ";
            sizeX = Math.round((pw / 72) * 100) / 100;
            sizeY = Math.round((ph / 72) * 100) / 100;
            break;
        case RulerUnits.Millimeters:
            sizeUnit = " 毫米 ";
            sizeX = Math.round(((pw / pointTomm) + 0.001) * 100) / 100;
            sizeY = Math.round(((ph / pointTomm) + 0.001) * 100) / 100;
            break;
        case RulerUnits.Points:
            sizeUnit = " 点 ";
            sizeX = Math.round(pw * 100) / 100;
            sizeY = Math.round(ph * 100) / 100;
            break;
        case RulerUnits.Pixels:
            sizeUnit = " 像素 ";
            sizeX = Math.round(pw * 100) / 100;
            sizeY = Math.round(ph * 100) / 100;
            break;
        case RulerUnits.Qs:
            sizeUnit = " Ha ";
            sizeX = Math.round(pw * 141.111) / 100;
            sizeY = Math.round(ph * 141.111) / 100;
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
            clipObj = obj[0].pathItems[0].geometricBounds;
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