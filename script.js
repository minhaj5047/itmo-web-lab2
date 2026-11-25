const SERVER_URL = "/fcgi-bin/server.jar";

let canvas = document.getElementById("graph");
let ctx = canvas.getContext("2d");
let form = document.getElementById("point-form");
let yInput = document.getElementById("y-input");
let errorBox = document.getElementById("error");
let tbody = document.getElementById("results-body");
let infoBox = document.getElementById("info");

const STEP = 52;
const cx = canvas.width / 2;
const cy = canvas.height / 2;

let data = [];
let r = 1;

function draw(radius) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#e6e6e6";
    ctx.beginPath();
    for (let i = -6; i <= 6; i++) {
        ctx.moveTo(cx + i * STEP, 0);
        ctx.lineTo(cx + i * STEP, canvas.height);
        ctx.moveTo(0, cy - i * STEP);
        ctx.lineTo(canvas.width, cy - i * STEP);
    }
    ctx.stroke();

    if (radius) {
        let rp = radius * STEP;
        ctx.fillStyle = "rgba(51, 153, 255, 0.75)";

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, rp, Math.PI, 1.5 * Math.PI);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + rp, cy);
        ctx.lineTo(cx, cy - rp);
        ctx.closePath();
        ctx.fill();

        ctx.fillRect(cx, cy, rp / 2, rp);
    }

    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(canvas.width, cy);
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, canvas.height);
    ctx.stroke();

    ctx.font = "13px Arial";
    ctx.fillText("x", canvas.width - 12, cy - 6);
    ctx.fillText("y", cx + 6, 12);

    for (let i = -5; i <= 5; i++) {
        if (i === 0) continue;
        let px = cx + i * STEP;
        let py = cy - i * STEP;
        ctx.beginPath();
        ctx.moveTo(px, cy - 3);
        ctx.lineTo(px, cy + 3);
        ctx.moveTo(cx - 3, py);
        ctx.lineTo(cx + 3, py);
        ctx.stroke();
        ctx.fillText(i, px - 4, cy + 15);
        ctx.fillText(i, cx + 6, py + 4);
    }

    for (let i = 0; i < data.length; i++) {
        let p = data[i];
        if (Number(p.r) === radius) {
            ctx.fillStyle = p.hit ? "#2e7d32" : "#c62828";
            ctx.beginPath();
            ctx.arc(cx + p.x * STEP, cy - Number(p.y) * STEP, 5, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
}

function picked(name) {
    let box = form.querySelector('input[name="' + name + '"]:checked');
    if (box) return Number(box.value);
    return null;
}

let allBoxes = form.querySelectorAll('input[type="checkbox"]');
for (let i = 0; i < allBoxes.length; i++) {
    allBoxes[i].addEventListener("change", function () {
        if (this.checked) {
            let group = form.querySelectorAll('input[name="' + this.name + '"]');
            for (let j = 0; j < group.length; j++) {
                if (group[j] !== this) group[j].checked = false;
            }
        }
    });
}

let rButtons = form.querySelectorAll('input[name="r"]');
for (let i = 0; i < rButtons.length; i++) {
    rButtons[i].addEventListener("click", function () {
        for (let j = 0; j < rButtons.length; j++) rButtons[j].classList.remove("active");
        this.classList.add("active");
        r = Number(this.value);
        draw(r);
    });
}

const XS = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
const RS = [1, 2, 3, 4, 5];

function yValue() {
    return yInput.value.replace(",", ".");
}

function inRange(t) {
    let whole = Number(t.replace("-", "").split(".")[0]);
    return whole < 5;
}

function ok() {
    let x = picked("x");
    if (x === null) return "Choose X";
    if (XS.indexOf(x) === -1) return "Bad X";

    let t = yValue();
    if (t === "") return "Enter Y";
    if (!/^[+-]?\d{1,20}(\.\d{1,20})?$/.test(t)) return "Y must be number";
    if (!inRange(t)) return "Y must be between -5 and 5 (exclusive)";

    if (RS.indexOf(r) === -1) return "Choose R";

    return "";
}

yInput.addEventListener("input", function () {
    let s = yInput.value.replace(/[^0-9.,-]/g, "");
    let neg = s.startsWith("-");
    s = s.replace(/-/g, "");
    let dot = s.search(/[.,]/);
    if (dot !== -1) {
        s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/[.,]/g, "");
    }
    yInput.value = (neg ? "-" : "") + s;
    errorBox.textContent = "";
});

function ask(options) {
    fetch(SERVER_URL, options)
        .then(function (response) {
            return response.json();
        })
        .then(function (answer) {
            if (answer.error) {
                errorBox.textContent = answer.error;
                return;
            }
            data = answer.results;
            showTable();
            draw(r);
            infoBox.textContent = "Server time: " + new Date(answer.now).toLocaleString("ru-RU")
                + " | Script time: " + (answer.execNs / 1000000).toFixed(3) + " ms";
        })
        .catch(function () {
            errorBox.textContent = "Server is not available";
        });
}

form.addEventListener("submit", function (e) {
    e.preventDefault();

    let msg = ok();
    errorBox.textContent = msg;
    if (msg) return;

    ask({
        method: "POST",
        body: new URLSearchParams({ x: picked("x"), y: yValue(), r: r })
    });
});

function showTable() {
    tbody.innerHTML = "";
    for (let i = data.length - 1; i >= 0; i--) {
        let p = data[i];
        let tr = document.createElement("tr");
        let values = [p.x, p.y, p.r, p.hit ? "Hit" : "Miss", new Date(p.time).toLocaleString("ru-RU"),
                      p.execNs ? (p.execNs / 1e6).toFixed(3) + " ms" : "-"];

        for (let j = 0; j < values.length; j++) {
            let td = document.createElement("td");
            td.textContent = values[j];
            if (j === 3) td.className = p.hit ? "hit" : "miss";
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
}

draw(r);
ask({ method: "GET" });