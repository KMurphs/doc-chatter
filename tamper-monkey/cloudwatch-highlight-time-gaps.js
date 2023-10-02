// ==UserScript==
// @name         CloudWatch Highlight Time Gaps
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  A script to have CloudWatch highlight log entries that were recorded later than some minimum time.
// @author       Stephane K.
// @match        *.console.aws.amazon.com/cloudwatch*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=amazon.com
// @grant        none
// ==/UserScript==

const LOG_ROW_SELECTOR = ".logs-table__body-row";
const LOG_TIMESTAMP_CELL_SELECTOR = ".logs-table__body-cell:nth-child(2)";
const SECONDS_GAP_TO_FIND = 60;
const HIGHLIGHT_COLOR = "#db7f7f";

(function() {
    'use strict';
    console.log("CloudWatch Time Gaps: Loaded");

    // Only run on log-insights
    if (!(/logs-insights/.test(location.href))) return;

    const rows = document.querySelectorAll(LOG_ROW_SELECTOR);
    Array
        .from(rows)
        .map(elt => elt.querySelectorAll(LOG_TIMESTAMP_CELL_SELECTOR))
        .filter((elt, i) => i > 0 && (Math.abs(new Date(elt.innerText) - new Date(rows[i - 1].innerText)) > (SECONDS_GAP_TO_FIND * 1000)))
        .map(elt => elt.style.backgroundColor = HIGHLIGHT_COLOR)
})();