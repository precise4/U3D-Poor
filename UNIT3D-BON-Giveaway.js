// ==UserScript==
// @name         UNIT3D BON Giveaway
// @description  Enables the functionality to become poor
// @version      1.1.6
// @license      GPL-3.0-or-later
// @match        https://upload.cx/
// @grant        none
// ==/UserScript==

// ==OpenUserJS==
// @author jacksaw
// ==/OpenUserJS==
// UNIT3D support dantayy

//Split entries table on scroll? Maybe just use tabulation for form and entries. Tabulation would allow for more detailed form
//2nd and 3rd?
//Add option to extend the time with gifts
//Add option to remove a user from the giveaway (not ban, just delete entry).
//remove panel-body padding for div that contains the form so the input layout will be condensed
// Optional setting (checkbox) "Lower rank priority" > when two users tie, the lower rank wins.
// Detect ongoing giveaways
// Possibly send all duplicate entries via chatpm instead of in the general chat to avoid spam. This could also allow to send messages to notify that the entry was successful.
// Add more ! commands (!abort, !removeBon, !expandEntryRange, !addTime, !pauseTimer, !resumeTimer)
// Handle decimal places for initial BON value

// BUGS
//Switching tabs reloads ALL messages in the cb, duplicating all BON gifts and spamming the chat. This can be achieved with the timestamps now included in the chatbox messages
//giveaway amount incorrect when BON donated after reset
// When doing a giveaway for 123 minutes, it will trigger a reminder right at the start (6 reminders, triggered at 2 hours, 2 minutes, 58 seconds)
//Modify timer so that timestamp is used in order to keep accuracy
// Validation of the entry range only sets one field red


const GENERAL_SETTINGS = {
    default_mins_per_reminder: 5,
    mins_per_reminder_limit: 3
}

// These settings can be used to test different portions of the script. By default, all should be set to false.
const DEBUG_SETTINGS = {
    log_chat_messages: true,
    disable_chat_output: true
}

// DOM Selectors here for easier compatibility
let messageSelector;
let authorSelector;
let botSelector;
let fancySelector;
let chatboxID;
let chatboxSelector;
const currentUrl = window.location.href

let newUnited = true

var processedGiftMessages = []

let autoSponsor = null
let giveawayStartTime = null
let aither = currentUrl.includes("aither")
let fear = currentUrl.includes("fear")
let ulcx = currentUrl.includes("upload")

// Sites that don't broadcast gift messages in the main chatbox
if (aither || fear || ulcx) {
    autoSponsor = false
} else {
    autoSponsor = true
}



let chatbox = null
let observer, giveawayData
let numberEntries = new Map()
let fancyNames = new Map()
const regNum = /^-?\d+$/ //
const regGift = /([^ \n]+)\shas\sgifted\s([0-9.]+)\sBON\sto\s([^ \n]+)/
const regAith = /">([^ \n]+)<\/a.*\(taxed\s([0-9.]+)\)\sBON\sto.*">([^ \n]+)<\/a/
// messages through the api are different <div><div><a href="https://fearnopeer.com/users/gifter">gifter</a> has gifted 13 BON to <a href="https://fearnopeer.com/users/recipient">recipient</a></div></div>
const regApi = /">([^ \n]+)<\/a.\shas\sgifted\s([0-9.]+)\sBON\sto.*">([^ \n]+)<\/a/
const whitespace = document.createTextNode(" ")


const sponsorMessages = {
    "aither": "Note: [color=#999999][b]Bon gifted to the host during the duration of the Giveaway will be added to the Pot! Adjusted with Aither tax.[/b][/color]",
    "fear": "Note: [color=#999999][b]Bon gifted to the host during the duration of the Giveaway will be added to the Pot![/b][/color]",
    "default": "Note: [color=#999999][b]Any BON gifted to the host during the duration of the Giveaway is automatically added to the Pot![/b][/color]"
    ,
}

// Setup giveaway menu
let coinsIcon = document.createElement("i")
coinsIcon.setAttribute("class", "fas fa-coins")

let goldCoins = document.createElement("i")
goldCoins.setAttribute("class", "fas fa-coins")
goldCoins.style.color = "#ffc00a"
goldCoins.style.padding = "5px"

let giveawayBTN = document.createElement("a")
giveawayBTN.setAttribute("class", "form__button form__button--text")
giveawayBTN.textContent = "Giveaway"
giveawayBTN.prepend(coinsIcon.cloneNode(false))
giveawayBTN.onclick = toggleMenu

let frameHTML = `
<section id="giveawayFrame" class="panelV2" style="width: 450px; height: 90%; position: fixed; z-index: 9999; inset: 50px 150px auto auto; overflow: auto; border-style: solid; border-width: 1px; border-color: black" hidden="true">
  <header class="panel__heading">
    <div class="button-holder no-space">
      <div class="button-left">
        <h4 class="panel__heading">
          <i class="fas fa-coins" style="padding: 5px;"></i>
          Giveaway Menu
        </h4>
      </div>
      <div class="button-right">
        <button id="resetButton" class="form__button form__button--text">
          Reset
        </button>
        <button id="closeButton" class="form__button form__button--text">
          Close
        </button>
      </div>
    </div>
  </header>
  <div class="panel__body">
    <h1 id="coinHeader" class="panel__heading--centered">
    </h1>
    <form class="form" id="giveawayForm" style="display: flex; flex-flow: column; align-items: center;">
      <p class="form__group" style="max-width: 35%;">
        <input class="form__text" required="" id="giveawayAmount" pattern="[0-9]*" value="" inputmode="numeric" type="text">
        <label class="form__label form__label--floating" for="giveawayAmount">
          Giveaway Amount
        </label>
      </p>
      <div class="panel__body" style="display: flex; justify-content: center; gap: 20px">
        <p class="form__group" style="width: 20%;">
          <input class="form__text" required="" id="startNum" pattern="[0-9]*" value="1" inputmode="numeric" type="text" maxlength="6">
          <label class="form__label form__label--floating" for="startNum">
            Start #
          </label>
        </p>
        <p class="form__group" style="width: 20%;">
          <input class="form__text" required="" id="endNum" pattern="[0-9]*" value="50" inputmode="numeric" type="text" maxlength="6">
          <label class="form__label form__label--floating" for="endNum">
            End #
          </label>
        </p>
      </div>
      <div class="panel__body" style="display: flex; justify-content: center; gap: 20px">
        <p class="form__group" style="width: 35%;">
        <input class="form__text" required="" id="timerNum" pattern="[0-9]*" value="15" inputmode="numeric" type="text">
        <label class="form__label form__label--floating" for="timerNum">
          Time (minutes)
        </label>
      </p>
        <p class="form__group" style="width: 35%;">
          <input class="form__text" required="" id="reminderNum" pattern="[0-9]*" value="2" inputmode="numeric" type="text">
          <label class="form__label form__label--floating" for="reminderNum">
            # of Reminders
          </label>
        </p>
      </div>
      <p class="form__group" style="text-align: center;">
        <button id="startButton" class="form__button form__button--filled">
          Start
        </button>
      </p>
    </form>
    <h2 id="countdownHeader" class="panel__heading--centered" hidden="">
    </h2>
    <div id="entriesWrapper" class="data-table-wrapper" hidden="">
      <table id="entriesTable" class="data-table">
        <thead>
          <tr>
            <th>
              User
            </th>
            <th>
              Entry #
            </th>
          </tr>
        </thead>
        <tbody>
        </tbody>
      </table>
    </div>
  </div>
</section>
`
// instantiate UI variables
let giveawayFrame, resetButton, closeButton, coinHeader, coinInput, startInput, endInput, timerInput, reminderInput, startButton, countdownHeader, entriesWrapper, giveawayForm
injectMenu()

function reminderAutoScaling() {

    let reminders = Math.floor(parseInt(timerInput.value) / GENERAL_SETTINGS.default_mins_per_reminder) - 1

    if (reminders < 0) {
        reminderInput.value = 0
    } else {
        reminderInput.value = reminders
    }

    reminderInput.setCustomValidity("")

}


// This could be improved
function entryRangeValidation() {
    if (parseInt(startInput.value) > parseInt(endInput.value)) {
        startInput.setCustomValidity("Start # should be lower than End #")
        endInput.setCustomValidity("Start # should be lower than End #")
    } else {
        startInput.setCustomValidity("")
        endInput.setCustomValidity("")
    }
}

function remindersValidation() {
    if (timerInput.value / reminderInput.value < GENERAL_SETTINGS.mins_per_reminder_limit) {
        reminderInput.setCustomValidity(`There cannot be more than 1 reminder every: ${parseTime(GENERAL_SETTINGS.mins_per_reminder_limit * 60000)}.`)
        reminderInput.reportValidity()
    } else {
        reminderInput.setCustomValidity("")
    }
}

function checkUnit3d() {
    const newUnit3d = document.querySelector("#chatbox_header div")
    const oldUnit3d = document.querySelector(".panel__heading#frameHeader .button-right")
    if (newUnit3d == null && oldUnit3d == null) {
        setTimeout(function () { checkUnit3d() }, 100)
    } else if (newUnit3d) {
        newUnited = true
        messageSelector = ".chatbox-message__content"
        authorSelector = ".user-tag"
        botSelector = ".chatbox-message__content"
        fancySelector = ".user-tag"
        chatboxSelector = "#chatbox_header div"
        chatboxID = "#chatbox__messages-create"
    } else if (oldUnit3d) {
        messageSelector = ".sent .text-bright div"
        authorSelector = ".list-group-item-heading span a"
        botSelector = ".sent div.system.bot"
        fancySelector = ".badge-user.text-bold"
        chatboxSelector = ".panel__heading#frameHeader .button-right"
        chatboxID = "#chat-message"
    } else {
        console.log("Something went wrong")
    }
}

function injectMenu() {
    var chatbox_header = document.querySelector("#chatbox_header div");
    if (chatbox_header == null) {
      setTimeout(function() {injectMenu()}, 100)
    }

    document.body.insertAdjacentHTML("beforeend", frameHTML)

    // New panel name
    chatbox_header.prepend(giveawayBTN)
    giveawayBTN.parentNode.insertBefore(whitespace, giveawayBTN.nextSibling)

    giveawayFrame = document.getElementById("giveawayFrame")
    resetButton = document.getElementById("resetButton")
    resetButton.onclick = resetGiveaway

    closeButton = document.getElementById("closeButton")
    closeButton.onclick = toggleMenu

    coinHeader = document.getElementById("coinHeader")
    coinHeader.textContent = document.getElementsByClassName("ratio-bar__points")[0].firstElementChild.textContent.trim()
    coinHeader.prepend(goldCoins.cloneNode(false))

    coinInput = document.getElementById("giveawayAmount")
    startInput = document.getElementById("startNum")
    endInput = document.getElementById("endNum")
    timerInput = document.getElementById("timerNum")
    reminderInput = document.getElementById("reminderNum")
    startButton = document.getElementById("startButton")
    startButton.onclick = startGiveaway

    countdownHeader = document.getElementById("countdownHeader")
    entriesWrapper = document.getElementById("entriesWrapper")
    giveawayForm = document.getElementById("giveawayForm")

    document.body.appendChild(giveawayFrame)

    // Attach event listener to scale the number of reminders automatically
    timerInput.addEventListener("input", function () { reminderAutoScaling() })

    // Add validation of the reminders to ensure that the frequency is not too high
    reminderInput.addEventListener("input", function () { remindersValidation() })

    // Add entry range validation to ensure endInput > startInput
    startInput.addEventListener("input", function () { entryRangeValidation() })
    endInput.addEventListener("input", function () { entryRangeValidation() })

}

function toggleMenu() {
    giveawayFrame.hidden = !giveawayFrame.hidden
}

function startGiveaway() {
    if (!giveawayForm[0].checkValidity() || !giveawayForm[1].checkValidity() || !giveawayForm[2].checkValidity() || !giveawayForm[3].checkValidity() || !giveawayForm[4].checkValidity() || !giveawayForm[5].checkValidity()) {
        return;
    }

    // Chatbox isnt caught at the beginning when the script loads, so I moved it here for now
    if (chatbox == null) {
        chatbox = document.querySelector(chatboxID)
    }
    giveawayStartTime = null;
    giveawayStartTime = new Date()
    startButton.disabled = true
    coinInput.disabled = true
    startInput.disabled = true
    endInput.disabled = true
    timerInput.disabled = true
    reminderInput.disabled = true

    let sponsorMessage

    if (aither) sponsorMessage = sponsorMessages.aither
    else if (fear) sponsorMessage = sponsorMessages.fear
    else sponsorMessage = sponsorMessages.default

    startButton.parentElement.hidden = true
    entriesWrapper.hidden = false

    var totalTimeMs = timerInput.value * 60000

    var reminderNum = parseInt(reminderInput.value)

    // Using this to pass by reference
    giveawayData = {
        host: document.getElementsByClassName("top-nav__username")[0].children[0].textContent.trim(),
        amount: parseInt(coinInput.value),
        startNum: parseInt(startInput.value),
        endNum: parseInt(endInput.value),
        totalEntries: parseInt(endInput.value) - parseInt(startInput.value) + 1,
        winningNumber: null,
        totalSeconds: totalTimeMs / 1000,
        timeLeft: totalTimeMs / 1000,
        reminderNum: reminderNum,
        reminderFreqSec: (totalTimeMs / 1000 / (reminderNum + 1)).toFixed(0),
        sponsors: [],
        // hack probably crappy, but it should work for now.
        winnerSent: false,
    }

    var currentBon = parseInt(document.getElementsByClassName("ratio-bar__points")[0].textContent.trim().replace(/\s/g, ''), 10)

    if (currentBon < giveawayData.amount) {
        window.alert(`GIVEAWAY ERROR: The amount entered (${giveawayData.amount}), is above your current BON (${currentBon}). You may need to refresh the page to update your BON amount.`)
        resetGiveaway(giveawayData)
    }
    else {
        giveawayData.winningNumber = getRandomInt(giveawayData.startNum, giveawayData.endNum)
        // Setup an alert when trying to exit the tab during a giveaway
        window.onbeforeunload = function () {
            return "Giveaway in progress"
        }
        var introMessage = "I am hosting a giveaway for [b][color=#ffc00a]" +
            `${giveawayData.amount} BON[/color][/b]. Entries will be open for [b][color=green]` +
            `${parseTime(totalTimeMs)}[/color][/b]. You may enter by submitting a whole number [b]between [color=red]` +
            `${giveawayData.startNum} and ${giveawayData.endNum}[/color] inclusive[/b]. ${sponsorMessage} [img]https://cdn.7tv.app/emote/635764cc11b745c4f0230c96/1x.webp[/img]`
        sendMessage(introMessage)
        if (observer) {
            startObserver()
        }
        else {
            addObserver(giveawayData)
        }
        giveawayData.countdownTimerID = countdownTimer(countdownHeader, giveawayData)
        if (!autoSponsor) {
            sponsorsInterval = setInterval(async () => { await getSponsors() }, 15000)
        }
        //MAYBE UNNEEDED RETURN?
        return false;
    }

}

function addObserver(giveawayData) {
    observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            for (var i = 0; i < mutation.addedNodes.length; i++) {
                var tablist = document.querySelectorAll('[role="tablist"]');
                var general = tablist[0].childNodes[0]
                //console.log(general)
                //if(general.className != "panel__tab panel__tab--active") {
                //  console.log("General chat is not active")
                //}

                // !!! Here it is really important not to pass the giveawayData object to the parseMessage function. If done so, then it will for some reason always retain the pointer of the first
                // reference it was given, therefore when more than one giveaway is done in a row, the following giveaways messages will be parsed against the old giveawayData information.
                parseMessage(mutation.addedNodes[i])

            }
        })
    })

    startObserver()
}

function startObserver() {
    let messageList = document.getElementsByClassName("chatroom__messages")[0]
    observer.observe(messageList, {
        childList: true
    })
}

function parseMessage(messageNode) {
    let messageContent
    let isBot
    if (newUnited) {
        isBot = messageNode.querySelector(botSelector) == null
    } else {
        isBot = messageNode.querySelector(botSelector) !== null
    }

    if (isBot) {
        if (newUnited) {
            messageContent = messageNode.querySelector(botSelector).querySelector("div").textContent
        } else {
            messageContent = messageNode.querySelector(botSelector).querySelector("div div").textContent

        }
    } else {
        messageContent = messageNode.querySelector(messageSelector).textContent
        var author = messageNode.querySelector(authorSelector).textContent.trim()
        var fancyName = messageNode.querySelector(fancySelector).outerHTML
    }
    let isValid = regNum.test(messageContent)
    if (isValid) {
        handleEntryMessage(parseInt(messageContent, 10), author, fancyName, giveawayData)
    } else if (messageContent[0] == "!") {
        handleGiveawayCommands(author, messageContent, fancyName, giveawayData)
    } else if (isBot && autoSponsor) {
        handleGiftMessage(messageContent, giveawayData)
    }
}


function handleGiveawayCommands(author, messageContent, fancyName, giveawayData) {
    let arguments = messageContent.substring(1).trim().split(" ")
    let command = arguments[0].toLowerCase()
    let userNumber = numberEntries.get(author)
    let message
    const validCommands = ['time', 'random', 'number', 'lucky', 'addbon', 'commands']

    if (!validCommands.includes(command)) {
        return
    }

    switch (command) {
        case 'time':
            message = `Time left in the giveaway: [b][color=green]${parseTime(giveawayData.timeLeft * 1000)}[/color][/b].`
            sendMessage(message)
            break
        case 'random':
            if (userNumber) {
                message = `Sorry [color=#d85e27]${author}[/color], but [color=#32cd53]you[/color] already entered with number [color=red][b]${userNumber}[/b][/color]!`
            } else {
                let randomNum = 0
                let currentNumbers = Array.from(numberEntries.values())
                do {
                    randomNum = Math.floor(Math.random() * (giveawayData.endNum - giveawayData.startNum + 1)) + giveawayData.startNum
                } while (currentNumbers.includes(randomNum))
                addNewEntry(author, fancyName, randomNum)
                message = `[color=#d85e27]${author}[/color] entered with number [color=green][b]${randomNum}[/b][/color]`
            }
            sendMessage(message)
            break
        case 'number':
            if (userNumber) {
                message = `[color=#d85e27]${author}[/color] your number is [color=red][b]${userNumber}[/b][/color]`
            } else {
                message = `[color=#d85e27]${author}[/color] you are not currently in the giveaway.`
            }
            sendMessage(message)
            break
        case 'lucky':
            message = `The current giveaway lucky number is: [b][color=green]${getLuckyNumber(giveawayData)}[/color][/b].`
            sendMessage(message)
            break
        case 'addbon':
            if (author == giveawayData.host) {
                let amount = parseFloat(arguments[1])
                if (!isNaN(amount) && amount > 0) {
                    giveawayData.amount += amount
                    message = `The host is adding [color=red][b]${amount}[/b][/color] BON to the pot! The total is now: [b][color=#ffc00a]${cleanPotString(giveawayData.amount)} BON[/color][/b]`
                }
            } else {
                message = "Only the host can use the !addbon command"
            }
            sendMessage(message)
            break
        case 'commands':
            message = "Valid commands are !random !number !lucky !time & for hosts !addbon"
            sendMessage(message)
            break
        default:
            break
    }
}


function handleEntryMessage(number, author, fancyName, giveawayData) {
    var repeatMessage
    // Check if number is legal
    if (number < giveawayData.startNum || number > giveawayData.endNum) {
        const outOfBoundsMessage = `Sorry [color=#d85e27]${author}[/color], but the number [color=red][b]${number}[/b][/color] is outside of the given range! Please try another number that is [b]between ${giveawayData.startNum} and ${giveawayData.endNum} inclusive[/b]!`
        sendMessage(outOfBoundsMessage)
        return;
    }
    for (let [msgAuthor, msgValue] of numberEntries.entries()) {
        if (msgAuthor == author) {
            repeatMessage = `Sorry [color=#d85e27]${author}[/color], but [color=#32cd53]you[/color] already entered with number [color=red][b]${msgValue}[/b][/color]!`
            sendMessage(repeatMessage)
            return;
        }
        else if (msgValue == number) {
            repeatMessage = `Sorry [color=#d85e27]${author}[/color], but [color=#32cd53]${msgAuthor}[/color] already entered with number [color=red][b]${number}[/b][/color]! Please try another number!`
            sendMessage(repeatMessage)
            return;
        }
    }
    if (!numberEntries.has(author)) {
        addNewEntry(author, fancyName, number)
    }
}

function addNewEntry(author, fancyName, number) {
    numberEntries.set(author, number)
    fancyNames.set(author, fancyName)
    updateEntries()
}

function handleGiftMessage(messageContent, giveawayData) {
    let gift;
    if (fear) {
        gift = regApi.exec(messageContent)
    } else if (aither) {
        gift = regAith.exec(messageContent)
    } else {
        gift = regGift.exec(messageContent)
    }
    var addAmount = parseFloat(gift[2])
    var gifter = gift[1]
    var recpt = gift[3]
    if (recpt == giveawayData.host) {
        giveawayData.amount += addAmount
        var giftMessage = `[color=green][b]${gifter}[/b][/color] is sponsoring [color=red][b]${addAmount}[/b][/color] additional BON! The total pot is now: [b][color=#ffc00a]${cleanPotString(giveawayData.amount)} BON[/color][/b]`
        sendMessage(giftMessage)
        // If not yet included, add gifter to the list of giveaway sponsors
        if (!giveawayData.sponsors.includes(gifter)) {
            giveawayData.sponsors.push(gifter)
        }
    }
}

async function getSponsors() {
    let chatroom = '11';
    const api = `${currentUrl}api/chat/messages/${chatroom}`;
    const startTimeTimestamp = giveawayStartTime.getTime();
    try {
        const response = await fetch(api, {
            method: 'GET',
            headers: {
                'Cookie': document.cookie // Include cookies from the main page
            }
        });
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        const systemMessages = data.data;
        const filteredMessages = systemMessages.filter(message => {
            const messageTime = new Date(message.created_at).getTime();
            const giftMessage = message.message.includes("gifted");
            return giftMessage && messageTime > startTimeTimestamp;
        });
        for (const msg of filteredMessages) {
            // prevent duplicate sponsorship messages
            if (!processedGiftMessages.includes(msg.id)) {
                const messageContent = msg.message;
                processedGiftMessages.push(msg.id)
                handleGiftMessage(messageContent, giveawayData);
            }
        }
    } catch (error) {
        console.error('There was a problem with the fetch operation:', error);
    }
};

function updateEntries() {
    let tableStart = "<thead><tr><th>User</th><th>Entry #</th></tr></thead><tbody>"
    let tableEntries = ""
    let tableEnd = "</tbody>"
    numberEntries.forEach((entry, author) => {
        let fancyName = fancyNames.get(author)
        tableEntries += `<tr><td>${fancyName}</td><td>${entry}</td></tr>`; //need ; to fix syntax highligthing
    })
    document.getElementById("entriesTable").innerHTML = tableStart + tableEntries + tableEnd
}

async function endGiveaway(giveawayData) {
    observer.disconnect()
    clearInterval(sponsorsInterval)
    // If the site doesn't have a gift messages broadcast, we need to get the sponsors from the api
    if (!autoSponsor) {
        await getSponsors()
    }

    if (numberEntries.size == 0) {
        var emptyMessage = `Unfortunately, no one has entered the giveaway so no one wins!`
        sendMessage(emptyMessage)
    } else {
        if (giveawayData.sponsors.length > 0) {
            var sponsorsMessage = `Thank you to all the additional sponsors! `
            sponsorsMessage += `[color=green][b]${giveawayData.sponsors[0]}[/b][/color]`
            var i = 1
            while (i < giveawayData.sponsors.length) {
                sponsorsMessage += `, [color=green][b]${giveawayData.sponsors[i]}[/b][/color]`
                i++
            }
            sendMessage(sponsorsMessage)
        }

        var bestGuess = Number.MAX_VALUE
        var tie = false
        var gapToWinningNumber, currentBestEntryGap
        var entryAuthor, tieAuthor, tieGuess
        numberEntries.forEach((entry, author) => {
            currentBestEntryGap = Math.abs(giveawayData.winningNumber - bestGuess)
            gapToWinningNumber = Math.abs(giveawayData.winningNumber - entry)
            if (currentBestEntryGap > gapToWinningNumber) {
                tie = false
                bestGuess = entry
                entryAuthor = author
            }
            else if (gapToWinningNumber == currentBestEntryGap) {
                tie = true
                tieAuthor = author
                tieGuess = entry
            }
        })

        if (bestGuess == giveawayData.winningNumber) {
            var winMessage = `With a guess of [color=green][b]${bestGuess}[/b][/color] hitting the winning number exactly, [color=red][b]${entryAuthor}[/b][/color] has won [color=#ffc00a][b]${cleanPotString(giveawayData.amount)} BON[/b][/color]!`
            sendMessage(winMessage)
        }
        else if (!tie) {
            var winMessage = `With a guess of [color=green][b]${bestGuess}[/b][/color] only [color=green][b]${Math.abs(giveawayData.winningNumber - bestGuess)}[/b][/color] away from the winning number [color=green][b]${giveawayData.winningNumber}[/b][/color], [color=red][b]${entryAuthor}[/b][/color] has won [color=#ffc00a][b]${cleanPotString(giveawayData.amount)} BON[/b][/color]!`
            sendMessage(winMessage)
        }
        else if (tie) {
            var tieMessage = `With a tie between [color=#d85e27][b]${entryAuthor}[/b][/color] ([b]${bestGuess}[/b]) and [color=#d85e27][b]${tieAuthor}[/b][/color] ([b]${tieGuess}[/b]), both being only [color=green][b]${Math.abs(giveawayData.winningNumber - bestGuess)}[/b][/color] away from the winning number [color=green][b]${giveawayData.winningNumber}[/b][/color], [color=red][b]${entryAuthor}[/b][/color] has won [color=#ffc00a][b]${cleanPotString(giveawayData.amount)} BON[/b][/color] as their entry was submitted first!`
            sendMessage(tieMessage)
        }
        else {
            console.log("Something went wrong while ending the giveaway")
        }
        if (!giveawayData.winnerSent) {
            giftWinner(entryAuthor, giveawayData.amount, giveawayData.host)
            // hopefully stops repeat gift bug
            giveawayData.winnerSent = true;
        }
    }

    // Clear onbeforeunload alert
    window.onbeforeunload = null
    clearInterval(giveawayData.countdownTimerID)
    observer.disconnect()
    delete giveawayData
}

function extractToken() {
        const tokenElement = document.querySelector('meta[name="csrf-token"]');
        return tokenElement ? tokenElement.content : 'Token not found';
}

function giftWinner(recipient, amount, user) {
	let res = fetch(`${currentUrl}/users/${user}/gifts`, {
		method: "POST",
		body: JSON.stringify({
    			_token: extractToken(),
    			bon: amount,
			message: "Congratulations! You won the giveaway!",
			recipient_username: recipient
		}),
		headers: {
                	'Cookie': document.cookie // Include cookies from the main page
            	},
		}
	);
	document.log(res.json())
	return res
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Unified all time related events in the countdown (endGiveaway and reminders) to avoid any kind of drifting between them.
function countdownTimer(display, giveawayData) {
    display.hidden = false
    var minutes, seconds
    var timerID = setInterval(function () {
        giveawayData.timeLeft--
        minutes = parseInt(giveawayData.timeLeft / 60, 10)
        seconds = parseInt(giveawayData.timeLeft % 60, 10)
        minutes = minutes < 0 ? "0" + minutes : minutes
        seconds = seconds < 10 ? "0" + seconds : seconds
        display.textContent = minutes + ":" + seconds

        if (giveawayData.timeLeft <= 0) {
            endGiveaway(giveawayData)
            return
        }
        else if (giveawayData.totalEntries == numberEntries.size) {
            // Color scheme of this message could be improved
            var earlyFinishMessage = "All [b][color=#ffc00a]" +
                `${giveawayData.totalEntries}[/color][/b] slot(s) filled up! Therefore, the giveaway is ending with [b][color=green]` +
                `${parseTime(giveawayData.timeLeft * 1000)}[/color][/b] remaining!`
            sendMessage(earlyFinishMessage)
            endGiveaway(giveawayData)
            return

        }
        else if ((giveawayData.timeLeft) % giveawayData.reminderFreqSec == 0) {
            let reminderMessage;
            let reminderSponsor;
            if (aither) reminderSponsor = sponsorMessages.aither;
            else if (fear) reminderSponsor = sponsorMessages.fear;
            else reminderSponsor = sponsorMessages.default;

            reminderMessage = `There is an ongoing giveaway for [b][color=#ffc00a]` +
                `${giveawayData.amount} BON[/color][/b]. Time left: [b][color=green]` +
                `${parseTime(giveawayData.timeLeft * 1000)}[/color][/b]. You may enter by submitting a whole number [b]between [color=red]` +
                `${giveawayData.startNum} and ${giveawayData.endNum}[/color] inclusive[/b]. ${reminderSponsor}`

            sendMessage(reminderMessage)
        }
    }, 1000)

    return timerID
}

function sendMessage(messageStr) {
    if (!DEBUG_SETTINGS.disable_chat_output) {
        chatbox.value = messageStr
        chatbox.dispatchEvent(new KeyboardEvent("keydown", {
            keyCode: 13
        }))
    }
    if (DEBUG_SETTINGS.log_chat_messages) {
        console.log(messageStr)
    }

}

function getLuckyNumber(giveawayData) {
    var rangeStart = giveawayData.startNum
    var rangeEnd = giveawayData.endNum
    var numbers = Array.from(numberEntries.values()).sort((a, b) => {
        if (a < b) {
            return -1
        } else {
            return 1
        }
    })
    numbers.push(rangeEnd + 1)
    var bestGap = 0
    var lucky = 0
    var pastNum = rangeStart - 1
    var currentNum, gap
    for (var i = 0; i < numbers.length; i++) {
        currentNum = numbers[i]
        gap = currentNum - pastNum
        if (gap > bestGap) {
            lucky = Math.floor(gap / 2) + pastNum
            bestGap = gap
        }
        pastNum = currentNum
    }
    return lucky

}

function cleanPotString(giveawayPotAmount) {
    if (giveawayPotAmount % 1 == 0) {
        return giveawayPotAmount
    } else {
        return giveawayPotAmount.toFixed(2)
    }
}

function parseTime(timeInMs) {
    var hours = Math.floor((timeInMs / 3600000) % 60)
    var minutes = Math.floor((timeInMs / 60000) % 60)
    var seconds = Math.floor((timeInMs / 1000) % 60)
    var timeString = ``
    if (hours > 0) {
        timeString += `${hours} hour`
        if (hours > 1) {
            timeString += `s`
        }
    }
    if (minutes > 0) {
        if (timeString != ``) {
            timeString += `, `
        }
        timeString += `${minutes} minute`
        if (minutes > 1) {
            timeString += `s`
        }
    }
    if (seconds > 0) {
        if (timeString != ``) {
            timeString += `, `
        }
        timeString += `${seconds} second`
        if (seconds > 1) {
            timeString += `s`
        }
    }
    return timeString
}

function resetGiveaway() {
    clearInterval(giveawayData.countdownTimerID)
    // Clear onbeforeunload alert
    window.onbeforeunload = null
    numberEntries = new Map()
    fancyNames = new Map()
    entriesWrapper.hidden = true
    countdownHeader.hidden = true
    startButton.parentElement.hidden = false
    startButton.disabled = false
    coinInput.disabled = false
    startInput.disabled = false
    endInput.disabled = false
    timerInput.disabled = false
    reminderInput.disabled = false
    observer.disconnect()
    delete observer
    giveawayForm.reset()
    updateEntries()
}
