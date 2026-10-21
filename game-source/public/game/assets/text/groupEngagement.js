document.addEventListener('DOMContentLoaded', function() {
    let voting = false;
    let newQR = document.createElement("canvas");
    newQR.id = "voters_qr";
    newQR.style.position = "fixed";
    newQR.style.width = "320px";
    newQR.style.height = "320px";
    newQR.style.background = "white";
    newQR.style.bottom = "65px";
    newQR.style.right = "25px";
    newQR.style.borderRadius = "0px";
    document.body.appendChild(newQR);
    let QRmessage = document.createElement("div");
    QRmessage.innerHTML = "SCAN TO JOIN";
    QRmessage.id = "voters_qr_message";
    QRmessage.style.textAlign = "center";
    QRmessage.style.background = "white";
    QRmessage.style.fontSize = "20pt";
    QRmessage.style.fontWeight = "bold";
    QRmessage.style.position = "fixed";
    QRmessage.style.width = "320px";
    QRmessage.style.bottom = "385px";
    QRmessage.style.right = "25px";
    QRmessage.style.paddingTop = "15px";
    QRmessage.style.borderRadius = "20px 20px 0px 0px";
    document.body.appendChild(QRmessage);
    let QRclose = document.createElement("button");
    QRclose.id = "voters_qr_close";
    QRclose.type = "button";
    QRclose.innerHTML = "&times;";
    QRclose.title = "Hide the join code";
    QRclose.setAttribute("aria-label", "Hide the scan to join panel");
    QRclose.style.position = "absolute";
    QRclose.style.top = "4px";
    QRclose.style.right = "6px";
    QRclose.style.background = "none";
    QRclose.style.border = "none";
    QRclose.style.padding = "0px 6px";
    QRclose.style.lineHeight = "1";
    QRclose.style.fontSize = "24pt";
    QRclose.style.color = "rgb(51, 51, 51)";
    QRclose.style.cursor = "pointer";
    QRclose.addEventListener("click", hideQrPanel);
    QRmessage.appendChild(QRclose);
    // The link is the same URL the QR encodes, for the people who cannot scan it.
    let QRlink = document.createElement("div");
    QRlink.id = "voters_qr_link";
    QRlink.style.position = "fixed";
    QRlink.style.width = "320px";
    QRlink.style.right = "25px";
    QRlink.style.bottom = "15px";
    QRlink.style.background = "white";
    QRlink.style.borderRadius = "0px 0px 20px 20px";
    QRlink.style.textAlign = "center";
    QRlink.style.fontSize = "8pt";
    QRlink.style.lineHeight = "1.2";
    QRlink.style.wordBreak = "break-all";
    QRlink.style.padding = "6px 12px";
    QRlink.style.boxSizing = "border-box";
    document.body.appendChild(QRlink);
    let QRlinkAnchor = document.createElement("a");
    QRlinkAnchor.target = "_blank";
    QRlinkAnchor.rel = "noopener";
    QRlink.appendChild(QRlinkAnchor);
    // The join code is only worth showing on the title screen. It goes away for good when the
    // player closes it or when the game starts, so it never covers the game itself.
    let qrPanelHidden = false;
    function hideQrPanel() {
        if (qrPanelHidden) return;
        qrPanelHidden = true;
        newQR.style.display = "none";
        QRmessage.style.display = "none";
        QRlink.style.display = "none";
    }
    // The link is the bottom of the panel, so it decides how high the QR and its header sit.
    function layoutQrPanel() {
        if (qrPanelHidden) return;
        let qrBottom = 15 + QRlink.offsetHeight;
        newQR.style.bottom = qrBottom + "px";
        QRmessage.style.bottom = (qrBottom + 320) + "px";
    }
    layoutQrPanel();
    let newDiv = document.createElement("div");
    newDiv.id = "voters_container";
    newDiv.innerHTML = "Voters<br/>";
    newDiv.style.width = "160px";
    newDiv.style.textAlign = "center";
    newDiv.style.minHeight = "240px";
    newDiv.style.position = "fixed";
    newDiv.style.top = "0px";
    newDiv.style.left = "0px";
    document.body.appendChild(newDiv);
    let newDiv2 = document.createElement("div");
    newDiv2.id = "time_container";
    newDiv2.innerHTML = "";
    newDiv2.style.width = "60px";
    newDiv2.style.fontSize = "32pt";
    newDiv2.style.backgroundColor = "rgb(255, 219, 140)";
    newDiv2.style.textAlign = "center";
    newDiv2.style.minHeight = "60px";
    newDiv2.style.position = "fixed";
    newDiv2.style.marginRight = "auto";
    newDiv2.style.marginLeft = "auto";
    newDiv2.style.top = "0px";
    newDiv2.style.left = "0px";
    newDiv2.style.right = "0px";
    newDiv2.style.borderRadius = "0px 0px 20px 20px";
    newDiv2.style.visibility = "hidden";
    document.body.appendChild(newDiv2);
    let voters = 0;
    let yesvotes = 0;
    let novotes = 0;
    let beats = 0;
    let receiverID = "";
    let timefortask = 0;
    // Create a Peer instance
    const peer = new Peer();
    peer.on('open', (id) => {
        console.log('My peer ID is:', id);
        receiverID = id;
        const joinUrl = 'https://cdhaoui.github.io/survivalofthebestfit-group-engagement/game/assets/vote.html#' + receiverID;
        QRlinkAnchor.href = joinUrl;
        QRlinkAnchor.textContent = joinUrl;
        layoutQrPanel();
        var qr = new QRious({
            element: document.getElementById('voters_qr'),
            size: 700,
            padding: 35,
            value: joinUrl
        });
        peer.on('connection', (conn) => {
            voters++;
            let newVoter = document.createElement("div");
            newVoter.id = conn.peer;
            newVoter.style.backgroundColor = "rgb(255, 219, 140)";
            newVoter.innerHTML = conn.peer.split("-")[0];
            newVoter.style.fontSize = "10pt";
            newVoter.style.padding = "2px";
            newVoter.style.textAlign = "center";
            newVoter.style.marginLeft = "3px";
            newVoter.style.marginTop = "3px";
            newVoter.style.display = "inline-flex";
            newDiv.appendChild(newVoter);
            conn.on('data', (data) => {
                console.log('received data: ' + data);
                if (data === 'yes') {
                    if(newVoter.style.backgroundColor == "rgb(255, 219, 140)") {
                        yesvotes++;
                        newVoter.style.backgroundColor = "rgb(64, 228, 75)";
                        console.log('Yes:', yesvotes);
                    } else if(newVoter.style.backgroundColor == "rgb(255, 121, 121)") {
                        yesvotes++;
                        novotes--;
                        newVoter.style.backgroundColor = "rgb(64, 228, 75)";
                        console.log('Yes:', yesvotes);
                    }
                }
                if (data === 'no') {
                    if(newVoter.style.backgroundColor == "rgb(255, 219, 140)") {
                        novotes++;
                        newVoter.style.backgroundColor = "rgb(255, 121, 121)";
                        console.log('No:', novotes);
                    } else if(newVoter.style.backgroundColor == "rgb(64, 228, 75)") {
                        novotes++;
                        yesvotes--;
                        newVoter.style.backgroundColor = "rgb(255, 121, 121)";
                        console.log('No:', novotes);
                    }
                }
                if(yesvotes + novotes == voters && voting == true){
                    voting = false;
                    if(yesvotes>=novotes)
                        document.getElementsByClassName("js-yes")[0].click();
                    else
                        document.getElementsByClassName("js-no")[0].click();
                }
            });
            conn.on('close', () => {
                console.log('Connection to voter ID:', conn.peer, 'closed');
                newDiv.removeChild(newVoter);
                voters--;
            });
            conn.on('disconnect', () => {
                console.log('disconnect');
            });
            conn.on('iceConnectionStateChange', () => {
                console.log(conn.iceConnectionState);
            });
        });
    });
    setInterval(function () {
        console.log("check")
        // Start has been clicked: the title screen is gone from the DOM, so the join panels follow it.
        if (!qrPanelHidden && document.querySelector(".js-titlepage") == null) {
            hideQrPanel();
        }
        if(voting && document.getElementsByClassName("js-yes")[0].checkVisibility() == true){
            beats = beats + 0.2;
            if(beats > timefortask){
                if(yesvotes>=novotes)
                    document.getElementsByClassName("js-yes")[0].click();
                else
                    document.getElementsByClassName("js-no")[0].click();
            } else {
                newDiv2.innerHTML = parseInt(timefortask - beats);
                newDiv2.style.visibility = "visible";
            }
        }
        if(voting && document.getElementsByClassName("js-yes")[0].checkVisibility() == false) {
            let participants = newDiv.getElementsByTagName("div")
            for(let i=0;i<participants.length;i++){
                participants[i].style.backgroundColor = "rgb(255, 219, 140)";
                yesvotes = 0;
                novotes = 0;
            }
            newDiv2.innerHTML = "";
            newDiv2.style.visibility = "hidden";
            voting = false;
        }
        if(!voting && document.getElementsByClassName("js-yes")[0].checkVisibility() == true) {
            let participants = newDiv.getElementsByTagName("div")
            for(let i=0;i<participants.length;i++){
                participants[i].style.backgroundColor = "rgb(255, 219, 140)";
                yesvotes = 0;
                novotes = 0;
            }
            var peopletohire = parseInt(document.getElementsByClassName("js-hiring-goal")[0].childNodes[1].innerText.replace(" person", "").replace(" people", ""));
            if(document.getElementsByClassName("js-timer")[0].checkVisibility() == true) {
                var timeleft = parseInt(document.getElementsByClassName("js-timer")[0].childNodes[1].innerText.split(":")[1]);
                timefortask = (timeleft - 2) / peopletohire
            } else {
                timefortask = 20
            }
            newDiv2.innerHTML = timefortask;
            newDiv2.style.visibility = "visible";
            beats = 0
            voting = true;
        }
    }, 200);
}, false);
