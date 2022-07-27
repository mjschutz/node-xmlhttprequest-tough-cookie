/*
**  xmlhttprequest-cookie -- Cookie-aware XMLHttpRequest Wrapper
**  Copyright (c) 2013-2019 Dr. Ralf S. Engelschall <rse@engelschall.com>
**
**  Permission is hereby granted, free of charge, to any person obtaining
**  a copy of this software and associated documentation files (the
**  "Software"), to deal in the Software without restriction, including
**  without limitation the rights to use, copy, modify, merge, publish,
**  distribute, sublicense, and/or sell copies of the Software, and to
**  permit persons to whom the Software is furnished to do so, subject to
**  the following conditions:
**
**  The above copyright notice and this permission notice shall be included
**  in all copies or substantial portions of the Software.
**
**  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
**  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
**  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
**  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
**  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
**  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
**  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
**
**  xmlhttprequest-cookie.js: the wrapper
*/

/*  external requirements  */
const Url = require("url");
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;
const tough = require('tough-cookie');

/*  create singleton cookie jar  */
const cookieJar = {
	jar: new tough.CookieJar(),
	setStore: function (store) { this.jar = this.jar.cloneSync(store); }
}

/*  receive cookies via HTTP "Set-Cookie" header(s)  */
const cookie_recv = function (url, xhr) {
    xhr.setDisableHeaderCheck(true);
    const cookies = xhr.getResponseHeader("Set-Cookie");
    if (typeof cookies === "object" && cookies !== null && cookies.length > 0) {
        for (let i = 0; i < cookies.length; i++) {
            const cookie = tough.Cookie.parse(cookies[i], url);
            cookieJar.jar.setCookieSync(cookie, url.href);
            if (xhr.debug)
                console.log("XMLHttpRequest-Cookie: received cookie: ", cookie);
        }
    }
    xhr.setDisableHeaderCheck(false);
};

/*  send cookies via HTTP "Cookie" header  */
const cookie_send = function (url, xhr) {
    xhr.setDisableHeaderCheck(true);
    let cookie = xhr.getRequestHeader("Cookie") || "";
    const cookies = cookieJar.jar.getCookiesSync(url.href);
    for (let i = 0; i < cookies.length; i++) {
        if (cookies[i].secure && url.protocol !== "https:")
            continue;
        if (cookies[i].httpOnly && url.protocol.match(/^https?:$/i) === null)
            continue;
        if (cookie !== "")
            cookie += "; ";
        cookie += cookies[i].key + "=" + cookies[i].value;
    }
    if (cookie !== "") {
        if (xhr.debug)
            console.log("XMLHttpRequest-Cookie: send cookie(s): ", cookie);
        xhr.setRequestHeader("Cookie", cookie);
    }
    xhr.setDisableHeaderCheck(false);
};

/*  define XMLHttpRequest wrapper constructor  */
const XMLHttpRequestWrapper = function () {
    /*  create object with original constructor  */
    const xhr = new XMLHttpRequest();

    /*  intercept "open" method to gather URL  */
    let url = null;
    const open_orig = xhr.open;
    xhr.open = function () {
        url = Url.parse(arguments[1]);
        return open_orig.apply(xhr, arguments);
    };
    

    /*  hook into the processing  */
    let openedOnce = false;
    xhr.addEventListener("readystatechange", function () {
        switch (xhr.readyState) {
            case this.OPENED:
                if (!openedOnce) {
                    cookie_send(url, xhr);
                    openedOnce = true;
                }
                break;
            case this.HEADERS_RECEIVED:
                cookie_recv(url, xhr);
                break;
            default:
                break;
        }
    });

    /*  provide a simple way to control debug messages  */
    xhr.debug = false;

    return xhr;
};

/*  export XMLHttpRequest wrapper constructor and the cookie jar  */
module.exports = {
    XMLHttpRequest: XMLHttpRequestWrapper,
    CookieJar: cookieJar
};
