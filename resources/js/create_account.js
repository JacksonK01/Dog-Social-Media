const submit_account_button = document.getElementById("submit-account")
const form = document.getElementById("account_form")
const username_field = document.getElementById("username")
const password_field = document.getElementById("password")

const error_prompt = document.getElementById("error-section")
const error_span = document.getElementById("error")

function onAccountCreate() {
    let pfp_option = null;

    document.getElementsByName("pfp-option").forEach((radio) => {
        if(radio.checked) {
            pfp_option = radio.value
        }
    })

    let to_send_json = {
        "username": username_field.value,
        "password": password_field.value,
        pfp_option
    }

    fetch("/api/create/account", {
        method: "POST",
        headers: { "Content-Type" : "application/json" },
        body: JSON.stringify(to_send_json)
    })
    .then(r => {
        return r.json()
    }).then(json => {
        if(json.status === "Success") {
            window.location.href = "/profile"
        } else if(json.status === "Failure") {
            error_span.textContent = " " + json.error
            error_prompt.hidden = false
        }
    })

    form.reset()
}

submit_account_button.addEventListener("click", onAccountCreate)

