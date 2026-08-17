const express = require('express')
const cookieParser = require('cookie-parser');
const data = require('./data.js')
//Got approval to use crypto
//Will only be used to generate uuids
const crypto = require('crypto')
const bcrypt = require('bcrypt')
const {isConnectedToDB} = require("./data");

const app = express()
const port = 4131

const SALT_ROUNDS = 10

const HTTP_STATUS_SUCCESS = 200
const HTTP_STATUS_CREATED = 201
const HTTP_NO_CONTENT = 204
const HTTP_REDIRECT = 302
const HTTP_BAD_REQUEST = 400
const HTTP_STATUS_NOT_FOUND = 404
const HTTP_TOO_LARGE = 413

app.set("views", "templates")
app.set("view engine", "pug")
app.use(express.static('resources'))
app.use("/api", express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())

//valid_keys is a list of keys and this function will
//make sure those keys exist in the json.
function checkValidJson(json, valid_keys) {
    if(json === undefined) {
        return false
    }

    let json_keys = Object.keys(json)
    if(json_keys.length <= 0) {
        return false
    }

    for(let i = 0; i < valid_keys.length; i++) {
        let key = valid_keys[i]
        if(!json_keys.includes(key)) {
            return false
        }
    }

    return true
}

//Parses date to be in UTC and look nice
function fixDate(date) {
    let new_date = new Date(date)
    let updated_format = new_date.toISOString().replace("T", " ").replace("Z", "")
    let i = updated_format.indexOf(".")
    updated_format = updated_format.substring(0, i)
    return updated_format
}

//Assumes the user is already verified
async function addPost(post, user) {
    let id = await data.getAmountOfPosts()
    let new_post = {
        id,
        "title": post.title,
        "origin_date": post.date,
        "content": post.content,
        "username": user
    }
    await data.addPost(new_post)
    return id
}

async function isUserLoggedIn(username, uuid) {
    return username !== undefined && uuid !== undefined && await data.verifyAccountWithUUID(username, uuid)
}

app.use(async (req, res, next) => {
    if(!await isConnectedToDB()) {
        res.status(HTTP_STATUS_NOT_FOUND).render("errors/404.pug", {"error": "Not connected to DB"})
        return
    }

    let user = req?.cookies?.username
    let uuid = req?.cookies?.uuid
    //Checking if either cookie is missing
    if(user === undefined || uuid === undefined || !await data.doesAccountExist(user)) {
        //Source: https://www.geeksforgeeks.org/web-tech/express-js-res-clearcookie-function/
        let options = { path: "/" }
        res.clearCookie('username', options)
            .clearCookie('uuid', options)
    }

    next()
    console.log("{HTTP METHOD: " + req.method + "} {URL: " + req.path + "} {RESPONSE CODE: " + res.statusCode + "}" + " {USER: " + user + "}")
})

//Source for passing an async function: https://zellwk.com/blog/async-await-express/
app.get(["/", "/home", "/home/:page"], async (req, res) => {
    let page = req?.params?.page
    let user = req?.cookies?.username
    let uuid = req?.cookies?.uuid

    //Sets to 0 to just get the first page of results
    if(page === undefined || isNaN(page)) {
        page = 0
    }

    let posts = await data.getPage(page)

    posts.forEach(post => {
        post.origin_date = fixDate(post.origin_date)
        if(post.edit_date) {
            post.edit_date = fixDate(post.edit_date)
        }
    })

    let amount_of_pages = await data.getAmountOfPages()
    let account = await data.getAccountWithUUID(user, uuid)

    res.status(HTTP_STATUS_SUCCESS).render("homepage.pug", {posts, account, amount_of_pages})
})

app.get("/post/:id", async (req, res) => {
    let post_id = req?.params?.id
    let user = req?.cookies?.username
    let uuid = req?.cookies?.uuid

    if(!await data.isValidPostId(post_id)) {
        res.status(HTTP_REDIRECT).redirect("/404")
        return
    }

    let post = await data.getPostAndAccount(post_id)
    let account = await data.getAccountWithUUID(user, uuid)

    let is_op = false
    let is_admin = false
    let is_deleted = post.deleted === 1

    if(await isUserLoggedIn(user, uuid)) {
        is_op = account.username === post.username
        is_admin = account.admin === 1
    }

    //If the post is deleted, and you are not an admin or the op
    if(is_deleted && !(is_admin || is_op)) {
        res.status(HTTP_REDIRECT).redirect("/404")
        return
    }

    post.origin_date = fixDate(post.origin_date)
    if(post.edit_date) {
        post.edit_date = fixDate(post.edit_date)
    }

    res.status(HTTP_STATUS_SUCCESS).render("view_post.pug", {post, account})
})

app.post("/api/comment_section", async (req, res) => {
    let json = req?.body
    let status = "Failure"

    if(!checkValidJson(json, ["post_id"])) {
        let error = "Invalid JSON Format"
        res.status(HTTP_BAD_REQUEST).send({status, error})
        return
    }

    status = "Success"
    let user = req?.cookies?.username
    let uuid = req?.cookies?.uuid
    let comments = await data.getCommentsForPost(json.post_id)
    let account = await data.getAccountWithUUID(user, uuid)
    comments.forEach(comment => comment.commented_date = fixDate(comment.commented_date))
    res.status(HTTP_STATUS_SUCCESS).send({status, account, comments})
})

app.get("/create/post", async (req, res) => {
    let user = req?.cookies?.username
    let uuid = req?.cookies?.uuid

    if(!await isUserLoggedIn(user, uuid)) {
        res.status(HTTP_REDIRECT).redirect(`/login`)
        return
    }

    res.status(HTTP_STATUS_SUCCESS).render("create_post.pug")
})

app.post("/confirm_post", async (req, res) => {
    let post = req?.body
    let user = req?.cookies?.username
    let uuid = req?.cookies?.uuid

    if(!checkValidJson(post, ["title", "content"])) {
        res.status(HTTP_BAD_REQUEST).render("errors/bad_request.pug")
        return
    }

    if(!await isUserLoggedIn(user, uuid)) {
        res.status(HTTP_REDIRECT).redirect(`/login`)
        return
    }

    let id = await addPost(post, user)
    res.status(HTTP_REDIRECT).redirect(`/home#post-${id}`)
})

app.get("/edit/:id", async (req, res) => {
    let post_id = req?.params?.id
    let user = req?.cookies?.username
    let uuid = req?.cookies?.uuid

    if(!await data.isValidPostId(post_id)) {
        res.status(HTTP_REDIRECT).redirect(`/404`)
        return
    }

    if(!await isUserLoggedIn(user, uuid)) {
        res.status(HTTP_REDIRECT).redirect(`/login`)
        return
    }

    if(!(await data.isUsersPost(user, post_id) || await data.isAdminAccount(user, uuid))) {
        res.status(HTTP_BAD_REQUEST).render("errors/edit_bad_request.pug")
        return
    }

    let post = await data.getPost(post_id)
    //edit.pug will check if the post is deleted, and it'll hide the form from you if the post is deleted
    res.status(HTTP_STATUS_SUCCESS).render("edit.pug", {post})
})

app.post("/confirm_edit", async (req, res) => {
    let user = req?.cookies?.username
    let uuid = req?.cookies?.uuid

    if(!await isUserLoggedIn(user, uuid)) {
        res.status(HTTP_REDIRECT).redirect(`/login`)
        return
    }

    let post = req?.body
    if(!checkValidJson(post, ["id", "title", "content"])) {
        res.status(HTTP_BAD_REQUEST).render("errors/edit_bad_request.pug")
        return
    }

    let id = post.id
    if(!await data.isValidPostId(id)) {
        res.status(HTTP_REDIRECT).redirect(`/404`)
        return
    }

    let is_admin = await data.isAdminAccount(user, uuid)

    if(!(await data.isUsersPost(user, id) || is_admin)) {
        res.status(HTTP_BAD_REQUEST).render("errors/edit_bad_request.pug")
        return
    }

    let is_deleted = (await data.getPost(id)).deleted === 1
    //If the post is deleted and you are not an admin, you cannot edit the post
    if(is_deleted && !is_admin) {
        res.status(HTTP_BAD_REQUEST).render("errors/edit_bad_request.pug")
        return
    }

    await data.editPost(post)
    res.status(HTTP_REDIRECT).redirect(`/search#post-${id}`)
})

app.delete("/api/delete", async (req, res) => {
    let json = req?.body

    if(!checkValidJson(json, ["type", "id"])) {
        res.status(HTTP_BAD_REQUEST).send("Invalid JSON Format")
        return
    }

    let type = json.type
    let id = json.id
    let user = req?.cookies?.username
    let uuid = req?.cookies?.uuid

    if(!await isUserLoggedIn(user, uuid)) {
        res.status(HTTP_BAD_REQUEST).send("Not Logged in")
        return
    }

    let is_admin = await data.isAdminAccount(user, uuid)
    let is_correct_account = false

    if(type === "post") {
        is_correct_account = await data.isUsersPost(user, id)
    } else if(type === "comment") {
        is_correct_account = await data.isUsersComment(user, id)
    }

    if(!(is_admin || is_correct_account)) {
        res.status(HTTP_BAD_REQUEST).send("Wrong user or not admin")
        return
    }

    if(type === "post") {
        await data.deletePost(id)
    } else if(type === "comment") {
        await data.deleteComment(id)
    }

    res.status(HTTP_NO_CONTENT).send(`Deleted ${type}: ${id}`)
})

app.post("/api/comment", async (req, res) => {
    let json = req?.body
    let status = "Failure"

    if(!checkValidJson(json, ["id", "comment"])) {
        let error = "Invalid JSON Format"
        res.status(HTTP_BAD_REQUEST).send({status, error})
        return
    }

    let user = req?.cookies?.username
    let uuid = req?.cookies?.uuid

    if(!await isUserLoggedIn(user, uuid)) {
        let error = "Not Logged In"
        res.status(HTTP_BAD_REQUEST).send({status, error})
        return
    }

    let id = json.id
    let post = await data.getPost(id)
    if(post === undefined || post.deleted === 1) {
        let error = "Post is missing"
        res.status(HTTP_BAD_REQUEST).send({status, error})
        return
    }

    status = "Success"
    let comment = json.comment
    await data.addComment(id, comment, user)
    res.status(HTTP_STATUS_CREATED).send({status})
})

app.get("/create/account", (req, res) => {
    res.status(HTTP_STATUS_SUCCESS).render("create_account.pug")
})

app.post("/api/create/account", async (req, res) => {
    let json = req?.body
    let status = "Failure"

    if(!checkValidJson(json, ["username", "password", "pfp_option"])) {
        let error = "Request did not have the correct keys for json"
        res.status(HTTP_BAD_REQUEST).send({status, error})
        return
    }

    let username = json.username

    if(username.length < 4) {
        let error = "Username too short"
        res.status(HTTP_BAD_REQUEST).send({status, error})
        return
    } else if(username.length > 20) {
        let error = "Username is too long"
        res.status(HTTP_TOO_LARGE).send({status, error})
        return
    }

    let password = json.password

    if(password.length < 4) {
        let error = "Password too short"
        res.status(HTTP_BAD_REQUEST).send({status, error})
        return
    } else if(password.length > 40) {
        let error = "Password is too long"
        res.status(HTTP_TOO_LARGE).send({status, error})
        return
    }

    if(await data.doesAccountExist(username)) {
        let error = "Account with this username already exists"
        res.status(HTTP_BAD_REQUEST).send({status, error})
        return
    }

    let pfp_option = json.pfp_option

    if(isNaN(pfp_option) || !(1 <= pfp_option && pfp_option <= 9)) {
        pfp_option = null
    }

    let uuid = crypto.randomUUID()
    const hpass = await bcrypt.hash(password, SALT_ROUNDS)
    let account = {
        username,
        uuid,
        "password": hpass,
        pfp_option
    }

    await data.createAccount(account)
    status = "Success"

    //I wanted to use .redirect() here but it would just ignore it for some reason
    let age = 24 * 60 * 60 * 1000
    res.cookie('username', username, { maxAge: age, path: "/" })
        .cookie('uuid', uuid, { maxAge: age, path: "/" })
        .status(HTTP_STATUS_CREATED).send({status})
})

app.get("/login", (req, res) => {
    res.status(HTTP_STATUS_SUCCESS).render("login.pug");
})

app.post("/api/login", async (req, res) => {
    let json = req?.body;
    let status = "Failure"

    if(!checkValidJson(json, ["username", "password"])) {
        let error = "Request did not have the correct keys for json"
        res.status(HTTP_BAD_REQUEST).send({status, error})
        return
    }

    //Don't need to check length, at this point, either the account exists or it does not.
    let user = json.username
    let pass = json.password

    if(user === '' || pass === '') {
        let error = "Did not enter values for username or password"
        res.status(HTTP_BAD_REQUEST).send({status, error})
        return
    }

    if(!(await data.doesAccountExist(user))) {
        let error = "Incorrect username or account does not exist"
        res.status(HTTP_BAD_REQUEST).send({status, error})
        return
    }

    let account = await data.getAccount(user)
    let hpass = account.password

    if(!await bcrypt.compare(pass, hpass)) {
        let error = "Incorrect password"
        res.status(HTTP_BAD_REQUEST).send({status, error})
        return
    }

    status = "Success"
    const uuid = account.uuid;
    let age = 24 * 60 * 60 * 1000
    //To prevent frontend JS from modifying cookies httpOnly: true
    //This is to make sure only the backend can access these cookies
    //Source: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cookies
    let options = { httpOnly: true, maxAge: age, path: "/" }
    res.cookie('username', user, options)
        .cookie('uuid', uuid, options)
        .status(HTTP_STATUS_SUCCESS)
        .send({status})
})

app.get("/profile", async (req, res) => {
    let user = req?.cookies?.username
    let uuid = req?.cookies?.uuid

    if(!await isUserLoggedIn(user, uuid)) {
        res.status(HTTP_REDIRECT).redirect(`/login`)
        return
    }

    let account = await data.getAccountWithUUID(user, uuid)
    account.creation_date = fixDate(account.creation_date)
    res.status(HTTP_STATUS_SUCCESS).render("profile.pug", {account})
})

app.get("/search", async (req, res) => {
    let user = req?.cookies?.username
    let uuid = req?.cookies?.uuid

    let account = undefined
    if(await data.verifyAccountWithUUID(user, uuid)) {
        account = await data.getAccountWithUUID(user, uuid)
        account.creation_date = fixDate(account.creation_date)
    }

    let keyword = req?.query?.keyword
    let posts = keyword === undefined ? await data.getEveryPost() : await data.searchKeywordInPosts(keyword)
    posts.forEach(post => {
        post.origin_date = fixDate(post.origin_date)
        if(post.edit_date) {
            post.edit_date = fixDate(post.edit_date)
        }
    })

    res.render("search.pug", {account, posts})
})

app.get("/secret/elevate/account", async (req, res) => {
    let user = req?.cookies?.username
    let uuid = req?.cookies?.uuid

    if(await data.verifyAccountWithUUID(user, uuid)) {
        await data.elevateToAdmin(user, uuid)
    }

    res.status(HTTP_REDIRECT).redirect("/profile")
})

app.post("/logout", async (req, res) => {
    let options = { path: "/" }
    res.clearCookie('username', options)
        .clearCookie('uuid', options)

    res.status(HTTP_REDIRECT).redirect("/home")
})

app.use((req, res) => {
    res.status(HTTP_STATUS_NOT_FOUND).render("errors/404.pug")
})

app.listen(4131, () => {
    console.log(`Server listening on port http://localhost:${port}`)
})