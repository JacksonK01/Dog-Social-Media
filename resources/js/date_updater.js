let display_date = document.getElementById('display_date')

updateDate()
setInterval(updateDate, 1000)

function updateDate() {
    display_date.innerText = " " + getNewDate()
}

function getNewDate() {
    let now = new Date().toISOString().replace("T", " ").replace("Z", " ")
    let i = now.indexOf(".")
    return now.substring(0, i)
}

