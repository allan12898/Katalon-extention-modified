var BGPage = chrome.extension.getBackgroundPage();

var blockStack = [];
var labels = {};
var expectingLabel = null;

var currentPlayingCommandIndex = -1;
var currentPlayingFromHereCommandIndex = 0;

var currentTestCaseId = "";
var isPause = false;
var pauseValue = null;
var isPlayingSuite = false;
var isPlayingAll = false;
var selectTabId = null;
var isSelecting = false;

var commandType = "";
var pageCount = 0;
var pageTime = "";
var ajaxCount = 0;
var ajaxTime = "";
var domCount = 0;
var domTime = "";
var implicitCount = 0;
var implicitTime = "";

var caseFailed = false;
var extCommand = new ExtCommand();


window.onload = function() {
    var recordButton = document.getElementById("record");
    var playButton = document.getElementById("playback");
    var stopButton = document.getElementById("stop");
    var pauseButton = document.getElementById("pause");
    var resumeButton = document.getElementById("resume");
    var playSuiteButton = document.getElementById("playSuite");
    var playSuitesButton = document.getElementById("playSuites");
    var showElementButton = document.getElementById("showElementButton")
    var selectElementButton = document.getElementById("selectElementButton");
    var suitePlus = document.getElementById("suite-plus");
    var suiteOpen = document.getElementById("suite-open");
    /*var recordButton = document.getElementById("record");*/
    //element.addEventListener("click",play);
    //Tim
    var referContainer=document.getElementById("refercontainer");
    var logContainer=document.getElementById("logcontainer");
    var saveLogButton=document.getElementById("save-log");


    saveLogButton.addEventListener("click",savelog);
    referContainer.style.display="none";
    $('#command-command').on('input change', function() {
        scrape(document.getElementById("command-command").value);
    });

    suitePlus.addEventListener("mouseover", mouseOnSuiteTitleIcon);
    suitePlus.addEventListener("mouseout", mouseOutSuiteTitleIcon);
    suiteOpen.addEventListener("mouseover", mouseOnSuiteTitleIcon);
    suiteOpen.addEventListener("mouseout", mouseOutSuiteTitleIcon);

    var logLi=document.getElementById("history-log");
    var referenceLi=document.getElementById("reference-log");
    var logState=true;
    var referenceState=false;


    

    recordButton.addEventListener("click", function(){

        // _gaq.push(['_trackEvent', 'app', 'record']);
        BGPage.startBackgroundRecording();

    });

    function startBackgroundRecording(){
        
        isRecording = !isRecording;
        if (isRecording) {
            recorder.attach(); //start record
            notificationCount = 0;
            // KAT-BEGIN focus on window when recording
            if (contentWindowId) {
                browser.windows.update(contentWindowId, {focused: true});
            }
            // KAT-END
            browser.tabs.query({windowId: extCommand.getContentWindowId(), url: "<all_urls>"})
            .then(function(tabs) {
                for(let tab of tabs) {
                    browser.tabs.sendMessage(tab.id, {attachRecorder: true});
                }
            });
            // KAT-BEGIN add space for record button label
            recordButton.childNodes[1].textContent = " Stop";
            switchRecordButton(false);
            // KAT-END
        }
        else { 
            recorder.detach(); //stop record
            browser.tabs.query({windowId: extCommand.getContentWindowId(), url: "<all_urls>"})
            .then(function(tabs) {
                for(let tab of tabs) {
                    browser.tabs.sendMessage(tab.id, {detachRecorder: true});
                }
            });
            // KAT-BEGIN add space for record button label
            recordButton.childNodes[1].textContent = " Record";
            switchRecordButton(true);
            // KAT-END
        }

    }



    playButton.addEventListener("click", function() {
        saveData();
        emptyNode(document.getElementById("logcontainer"));
        document.getElementById("result-runs").textContent = "0";
        document.getElementById("result-failures").textContent = "0";
        recorder.detach();
        initAllSuite();
        setCaseScrollTop(getSelectedCase());
        // KAT-BEGIN focus on window when playing test case
        if (contentWindowId) {
            browser.windows.update(contentWindowId, {focused: true});
        }
        declaredVars = {};
        clearScreenshotContainer();
        expectingLabel = null;
        // KAT-END

        var s_suite = getSelectedSuite();
        var s_case = getSelectedCase();
        sideex_log.info("Playing test case " + sideex_testSuite[s_suite.id].title + " / " + sideex_testCase[s_case.id].title);
        logStartTime();
        play();
    });
    stopButton.addEventListener("click", function() {
        stop();
    });
    pauseButton.addEventListener("click", pause);
    resumeButton.addEventListener("click", resume);
    playSuiteButton.addEventListener("click", function() {
        saveData();
        emptyNode(document.getElementById("logcontainer"));
        document.getElementById("result-runs").textContent = "0";
        document.getElementById("result-failures").textContent = "0";
        recorder.detach();
        initAllSuite();
        // KAT-BEGIN focus on window when playing test suite
        if (contentWindowId) {
            browser.windows.update(contentWindowId, {focused: true});
        }
        declaredVars = {};
        clearScreenshotContainer();
        // KAT-END
        playSuite(0);
    });
    playSuitesButton.addEventListener("click", function() {
        saveData();
        emptyNode(document.getElementById("logcontainer"));
        document.getElementById("result-runs").textContent = "0";
        document.getElementById("result-failures").textContent = "0";
        recorder.detach();
        initAllSuite();
        // KAT-BEGIN focus on window when playing test suite
        if (contentWindowId) {
            browser.windows.update(contentWindowId, {focused: true});
        }
        declaredVars = {};
        clearScreenshotContainer();
        // KAT-END
        playSuites(0);
    });
    selectElementButton.addEventListener("click",function(){
        var button = document.getElementById("selectElementButton");
        if (isSelecting) {
            isSelecting = false;
            // KAT-BEGIN hide button label and remove active class
            // button.textContent = "Select";
            button.classList.remove("active");
            // KAT-END
            browser.tabs.query({
                active: true,
                windowId: contentWindowId
            }).then(function(tabs) {
                browser.tabs.sendMessage(tabs[0].id, {selectMode: true, selecting: false});
            }).catch(function(reason) {
                console.log(reason);
            })
            return;
        }

        isSelecting = true;
        if (isRecording)
            recordButton.click();
        // KAT-BEGIN hide button label and add active class
        // button.textContent = "Cancel";
        button.classList.add("active")
        // KAT-END
        browser.tabs.query({
            active: true,
            windowId: contentWindowId
        }).then(function(tabs) {
            if (tabs.length === 0) {
                console.log("No match tabs");
                isSelecting = false;
                // KAT-BEGIN hide button label and add active class
                // button.textContent = "Select";
                button.classList.remove("active");
                // KAT-END
            } else
                browser.tabs.sendMessage(tabs[0].id, {selectMode: true, selecting: true});
        })
    });
    showElementButton.addEventListener("click", function(){
        try{
            var targetValue = document.getElementById("command-target").value;
            if (targetValue == "auto-located-by-tac") {
                targetValue = document.getElementById("command-target-list").options[0].text;
            }
            browser.tabs.query({
                active: true,
                windowId: contentWindowId
            }).then(function(tabs) {
                if (tabs.length === 0) {
                    console.log("No match tabs");
                } else {
                    browser.webNavigation.getAllFrames({tabId: tabs[0].id})
                        .then(function(framesInfo){
                            var frameIds = [];
                            for (let i = 0; i < framesInfo.length; i++) {
                                frameIds.push(framesInfo[i].frameId)
                            }
                            frameIds.sort();
                            var infos = {
                                "index": 0,
                                "tabId": tabs[0].id,
                                "frameIds": frameIds,
                                "targetValue": targetValue
                            };
                            sendShowElementMessage(infos);
                        });
                }
            });
        } catch (e) {
            console.error(e);
        }
    });
};

function enableButton(buttonId) {
    document.getElementById(buttonId).disabled = false;
}

function disableButton(buttonId) {
    document.getElementById(buttonId).disabled = true;
}
