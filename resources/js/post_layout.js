let posts = document.getElementsByClassName("post")
//ex. if not_preview_flag === null then we are on the homepage, otherwise we are viewing the whole post
let not_preview_flag = document.getElementById("not-preview-flag")

//Source for redirect: https://stackoverflow.com/questions/503093/how-do-i-redirect-to-another-webpage
//Source for getting elements from div: https://stackoverflow.com/questions/7171483/simple-way-to-get-element-by-id-within-a-div-tag
function onPostClicked(post) {
    let id = post.querySelector("#post-id").textContent
    window.location.href = `/post/${id}`
}

function onEditButtonClicked(post) {
    let id = post.querySelector("#post-id").textContent
    window.location.href = `/edit/${id}`
}

function onDeleteButtonClicked(post) {
    let id = post.querySelector("#post-id").textContent

    let post_id_json = {
        "type": "post",
        "id": id
    }

    fetch("/api/delete", {
        method: "DELETE",
        headers: { "Content-Type" : "application/json" },
        body: JSON.stringify(post_id_json)
    }).then((r) => {
        //If not preview flag equals null then we are viewing a preview of the post
        //Otherwise we are viewing the post in full
        //This is useful to have different functionality when deleting a post
        if(not_preview_flag === null) {
            post.hidden = true
        } else {
            post.replaceChildren()
            let new_h2 = document.createElement("h1")
            new_h2.textContent = "This post has been deleted"
            post.appendChild(new_h2)
        }
    })

}

for(let i = 0; i < posts.length; i++) {
    let post = posts[i]

    //Body of the post is where the text goes
    let body = post.querySelector("#body")
    if(not_preview_flag === null) {
        body.addEventListener("click", () => {onPostClicked(post)})
    }

    let edit_button = post.querySelector("#edit")
    if(edit_button !== null) {
        edit_button.addEventListener("click", () => {onEditButtonClicked(post)})
    }

    let delete_button = post.querySelector("#delete")
    if(delete_button !== null) {
        delete_button.addEventListener("click", () => {onDeleteButtonClicked(post)})
    }
}
