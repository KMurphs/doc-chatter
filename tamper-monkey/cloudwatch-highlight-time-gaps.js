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
const SCRIPT_NAME = "CloudWatch Time Gaps";
const CLOUDWATCH_SCHEDULER = "cloudwatchScriptScheduler";
const SUBDOCUMENT_CONTAINER_SELECTOR = "#microConsole-Logs";

(function() {
    'use strict';
    // Only run on log-insights
    if (!(/logs-insights/.test(location.href))) return;

    // Setup scripts to run every x secs
    if(!window[CLOUDWATCH_SCHEDULER]){
         console.log("Setting up Cloudwatch Script Scheduler");
         // Map from script names to script functions
         window[CLOUDWATCH_SCHEDULER] = {};
        // Side effect runner
        setInterval(() => {
            Object.values(window[CLOUDWATCH_SCHEDULER]).map(fn => fn && fn());
        }, 1000);
    }

    // Setup script function
    console.log(`${SCRIPT_NAME}: Loaded`);
    window[CLOUDWATCH_SCHEDULER][SCRIPT_NAME] = () => {
        const subDocument = document.querySelector(SUBDOCUMENT_CONTAINER_SELECTOR).contentWindow.document;
        const rows = subDocument.querySelectorAll(LOG_ROW_SELECTOR);

        Array
            .from(rows)
            .map(elt => elt.querySelector(LOG_TIMESTAMP_CELL_SELECTOR))
            .filter((elt, i, rows) => i > 0 && (Math.abs(new Date(elt.innerText) - new Date(rows[i - 1].innerText)) > (SECONDS_GAP_TO_FIND * 1000)))
            .map(elt => (elt.style.backgroundColor = HIGHLIGHT_COLOR));
    }
})();