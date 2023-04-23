// ==UserScript==
// @name         CloudWatch Wrap Logs
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  A script to have CloudWatch logs wrap in the console by default.
// @author       Stephane K.
// @match        *.console.aws.amazon.com/cloudwatch*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=amazon.com
// @grant        none
// ==/UserScript==


(function() {
    'use strict';
    const scriptFlag = "wrapping-logs";
    console.log("CloudWatch Wrap Logs: Loaded");

    // Only run on log-insights
    if (!(/logs-insights/.test(location.href))) return;

    // Side effect runner
    const fn = () => {
        if(!document.body.getAttribute(scriptFlag)){
            document.body.setAttribute(scriptFlag, "true");
        }
        if(document.body.getAttribute(scriptFlag) !== "true") return;


        const logRows = Array.from(
            document.querySelector("#microConsole-Logs")
                   .contentWindow
                   .document
                   .querySelectorAll(".logs-table__body-row")
        );
        if(!logRows.length) return;


        console.log("Overriding styles");
        logRows.map(i => {
            i.style.width = "unset";
            Array.from(i.querySelectorAll(".logs-table__body-cell"))
                 .map(i => {
                      i.style.paddingRight = "5rem";
                      i.style.wordWrap = "anywhere";
                      i.style.whiteSpace = "break-spaces";
                 })
        });
    }

    setInterval(fn, 1000);
})();