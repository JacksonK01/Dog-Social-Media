const submit_button = document.getElementById("submit")
const post_id = document.getElementById("id")
const comment = document.getElementById("comment")
const form = document.getElementById("leave-comment")
const comment_section = document.getElementById("comment-section")

function onSubmit() {
    if (comment.value === '') {
        return
    }

    let comment_json = {
        "id": post_id.textContent,
        "comment": comment.value
    }

    fetch("/api/comment", {
        method: "POST",
        headers: { "Content-Type" : "application/json" },
        body: JSON.stringify(comment_json)
    }).then(r => {
        return r.json()
    }).then(json => {
        if(json.status === "Success") {
            loadCommentSection()
        }
    })

    form.reset()
}

function loadCommentSection() {
    let json = {
        "post_id": post_id.textContent,
    }

    fetch("/api/comment_section", {
        method: "POST",
        headers: { "Content-Type" : "application/json" },
        body: JSON.stringify(json)
    }).then(r => {
        return r.json()
    }).then(result_json => {
        if(result_json.status === "Success") {
            let comments_json_list = result_json.comments
            let account = result_json.account

            //Source to remove children: https://stackoverflow.com/questions/3955229/remove-all-child-elements-of-a-dom-node-in-javascript
            comment_section.replaceChildren()
            for(let i = 0; i < comments_json_list.length; i++) {
                let comment_json = comments_json_list[i]
                let should_button_render = account !== undefined && (account.username === comment_json.user_commented || account.admin === 1)
                addNewComment(comment_json, should_button_render)
            }
        } else if(result_json.status === "Failure") {
            let p = document.createElement("p")
            p.textContent = "Unable to load comment section. Reason: " + result_json.error
            comment_section.appendChild(p)
        }
    })
}

//Source: https://stackoverflow.com/questions/2007357/how-to-set-dom-element-as-first-child
function addNewComment(comment_json, should_button_render) {
    let new_comment = createComment(comment_json, should_button_render)
    comment_section.appendChild(new_comment)
}

//Source: https://www.w3schools.com/jsref/met_document_createelement.asp
//Source: https://stackoverflow.com/questions/507138/how-to-add-a-class-to-a-given-element
//Source: https://stackoverflow.com/questions/19625646/javascript-adding-an-id-attribute-to-another-created-element
//Returns a div containing elements of a comment
function createComment(comment_json, should_button_render) {
    let new_comment_div = document.createElement("div")
    new_comment_div.classList.add("comment")
    new_comment_div.setAttribute("id", `comment-${comment_json.comment_id}`)

    let profile_div = document.createElement("div")
    profile_div.setAttribute("id", "comment-profile")

    let pfp = document.createElement("img")
    let pfp_option = comment_json.pfp_option
    if(!isNaN(pfp_option) && 1 <= pfp_option && pfp_option <= 9) {
        pfp.src = `/images/pfp-${pfp_option}.png`
    } else {
        pfp.src = `/images/pfp-generic.png`
    }

    let user_h4 = document.createElement("h4")
    user_h4.textContent = comment_json.user_commented

    profile_div.appendChild(pfp)
    profile_div.appendChild(user_h4)

    let date_posted_h6 = document.createElement("h6");
    date_posted_h6.textContent = `Commented: ${comment_json.commented_date}`

    let comment_content_p = document.createElement("p")
    comment_content_p.textContent = comment_json.comment_content

    let delete_button = document.createElement("button")
    delete_button.setAttribute("id", "delete")
    delete_button.textContent = "Delete"
    delete_button.addEventListener("click", () => {onDelete(comment_json.comment_id)})

    new_comment_div.appendChild(profile_div)
    new_comment_div.appendChild(comment_content_p)
    new_comment_div.appendChild(date_posted_h6)
    if(should_button_render) {
        new_comment_div.appendChild(delete_button)
    }

    return new_comment_div
}

function onDelete(comment_id) {
    let delete_json = {
        "type": "comment",
        "id": comment_id
    }

    fetch("/api/delete", {
        method: "DELETE",
        headers: { "Content-Type" : "application/json" },
        body: JSON.stringify(delete_json)
    }).then((r) => {
        let comment = document.getElementById(`comment-${comment_id}`)
        comment.hidden = true
    })
}

if(submit_button !== null) {
    submit_button.addEventListener(("click"), onSubmit)
}

loadCommentSection()