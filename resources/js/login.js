let login_form = document.getElementById("login-form")
let login_button = document.getElementById("submit")
let user_textbox = document.getElementById("username")
let pass_textbox = document.getElementById("password")

const error_prompt = document.getElementById("error-section")
const error_span = document.getElementById("error")

function onLoginAttempt() {
    let login_data = {
        "username" : user_textbox.value,
        "password" : pass_textbox.value
    }

    fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type" : "application/json" },
        body: JSON.stringify(login_data)
    })
    .then(r => {return r.json()})
    .then(json => {
        console.log(json)
        if(json.status === "Success") {
            window.location.href = "/profile"
        } else if(json.status === "Failure") {
            error_span.textContent = " " + json.error
            error_prompt.hidden = false
        }
    })

    login_form.reset()
}

login_button.addEventListener("click", onLoginAttempt)