const mysql = require("mysql2/promise");

var connPool = mysql.createPool({
    connectionLimit: 5,
    host: "127.0.0.1",
    user: "C4131F25U63",
    database: "C4131F25U63",
    password: "4019",
});

//Helper functions are not allowed outside of this file

//Max posts displayed per page
const MAX_PER_PAGE = 10

function getCurrentDate() {
    return new Date().toISOString().replace("T", " ").replace("Z", "")
}

async function getPost(post_id) {
    let query = `SELECT * FROM Posts WHERE id = ?`
    let result = await connectionHelper(query, [post_id])

    if(result !== undefined) {
        return result[0][0]
    }

    return result
}

async function getPostAndAccount(post_id) {
    let query = `
        SELECT id, title, content, origin_date, edit_date, deleted, username, pfp_option, admin
        FROM Posts JOIN Accounts ON Posts.user_posted = Accounts.username 
        WHERE id = ?`
    let result = await connectionHelper(query, [post_id])

    if(result !== undefined) {
        return result[0][0]
    }

    return result
}

async function getEveryPost() {
    let query = `
        SELECT id, title, content, origin_date, edit_date, deleted, username, pfp_option, admin 
        FROM Posts JOIN Accounts ON Posts.user_posted = Accounts.username
        WHERE deleted = FALSE
        ORDER BY origin_date DESC`
    let result = await connectionHelper(query, [])
    if(result !== undefined) {
        return result[0]
    }
    return result
}

//Source: https://stackoverflow.com/questions/759580/how-to-implement-a-keyword-search-in-mysql
async function searchKeywordInPosts(keyword) {
    let query = `
        SELECT id, title, content, origin_date, edit_date, deleted, username, pfp_option, admin 
        FROM Posts JOIN Accounts ON Posts.user_posted = Accounts.username
        WHERE deleted = FALSE AND (title LIKE ? OR content LIKE ?)
        ORDER BY origin_date DESC`
    let parameter = `%${keyword}%`
    let result = await connectionHelper(query, [parameter, parameter])
    if(result !== undefined) {
        return result[0]
    }
    return []
}

//Return a full page of blog posts
async function getPage(page) {
    let total_pages = await getAmountOfPages()

    let p = 0
    if(!isNaN(page) && 0 <= page && page < total_pages) {
        p = page
    }
    let offset = p * MAX_PER_PAGE

    //Source: https://www.datacamp.com/doc/mysql/mysql-offset?utm_cid=23137901673&utm_aid=187105808116&utm_campaign=230119_1-ps-other~dsa~tofu-docs_2-b2c_3-nam_4-prc_5-na_6-na_7-le_8-pdsh-go_9-nb-e_10-na_11-na&utm_loc=9019677-&utm_mtd=-c&utm_kw=&utm_source=google&utm_medium=paid_search&utm_content=ps-other~nam-en~dsa~tofu~docs~mysql&gad_source=1&gad_campaignid=23137901673&gbraid=0AAAAADQ9WsETkQaEPzOpBZedjYrgTwkHi&gclid=Cj0KCQiAosrJBhD0ARIsAHebCNoc2nB0Q7JBndHRf4wgwORqMeCJ5NXkA-42lzePuREBQgCVh0ANd3UaAqBzEALw_wcB
    let query = `
        SELECT id, title, content, origin_date, edit_date, deleted, username, pfp_option, admin
        FROM Posts JOIN Accounts ON Posts.user_posted = Accounts.username
        WHERE deleted = FALSE
        ORDER BY origin_date DESC
        LIMIT ${MAX_PER_PAGE} OFFSET ${offset}
    `
    let result = await connectionHelper(query)

    if(result) {
        return result[0]
    }

    return undefined
}

async function getAmountOfPages() {
    let total_posts = await getAmountOfPostsWithoutDeleted()
    return Math.ceil(total_posts / MAX_PER_PAGE)
}

async function getAmountOfPostsWithoutDeleted() {
    let query = `SELECT COUNT(*) FROM Posts WHERE deleted = FALSE`
    let result = await connectionHelper(query, [])

    if(result === undefined) {
        return -1
    }

    return result[0][0]['COUNT(*)']
}

//Given a post object
async function addPost(post) {
    let query = `
             INSERT INTO Posts (id, title, content, origin_date, edit_date, deleted, user_posted) VALUES
             (?, ?, ?, ?, NULL, FALSE, ?)`
    let params = [post.id, post.title, post.content, getCurrentDate(), post.username]
    return connectionHelper(query, params)
}

async function editPost(post) {
    let id = post.id
    let update_date = getCurrentDate()
    let query =
        `UPDATE Posts 
         SET title = ?, content = ?, edit_date = '${update_date}'
         WHERE id = ?`
    let params = [post.title, post.content, id]
    await connectionHelper(query, params)
    return getPost(id)
}

async function deletePost(post_id) {
    let query =
        `UPDATE Posts 
         SET deleted = TRUE
         WHERE id = ?`
    await connectionHelper(query, [post_id])
}

async function getAmountOfPosts() {
    let query = `SELECT COUNT(*) FROM Posts`
    let result = await connectionHelper(query, [])

    if(result === undefined) {
        return -1
    }

    return result[0][0]['COUNT(*)']
}

async function getComment(comment_id) {
    let query = `
        SELECT * FROM Comments WHERE comment_id = ?
    `
    let result = await connectionHelper(query, [comment_id])

    if(result !== undefined) {
        return result[0][0]
    }

    return undefined
}

//You are not given a comment object for this function.
//This function assumes the username is who they claim to be,
//which must be verified outside of this function.
async function addComment(post_id, commend_content, username) {
    let query = `
             INSERT INTO Comments (post_id, comment_content, commented_date, comment_deleted, user_commented) VALUES
             (?, ?, ?, FALSE, ?)`
    let params = [post_id, commend_content, getCurrentDate(), username]
    let result = await connectionHelper(query, params)

    //This value corresponds with the comment added
    let comment_id = result[0].insertId

    return await getComment(comment_id)
}

async function getCommentsForPost(post_id) {
    let query = `
    SELECT comment_id, user_commented, commented_date, comment_content, pfp_option
    FROM Posts JOIN Comments JOIN Accounts ON Posts.id = Comments.post_id AND Accounts.username = Comments.user_commented
    WHERE Posts.id = ? AND Comments.comment_deleted = FALSE
    ORDER BY Comments.commented_date DESC
    `
    let result = await connectionHelper(query, [post_id])

    if(result !== undefined) {
        return result[0]
    }

    return undefined
}

async function deleteComment(comment_id) {
    let query =
        `UPDATE Comments 
         SET comment_deleted = TRUE
         WHERE comment_id = ?`
    await connectionHelper(query, [comment_id])
}

//This is unsafe, only used to get the hashed password for login attempts
async function getAccount(username) {
    if(username === undefined) {
        return undefined
    }

    let query = `
        SELECT * FROM Accounts
        WHERE username = ?
    `

    let result = await connectionHelper(query, [username])

    //If result is undefined or nothing is returned from the query
    if (!result || result[0].length === 0) {
        return undefined
    }

    return result[0][0]
}

async function getAccountWithUUID(username, uuid) {
    return await getAccountHelper(username, "uuid", uuid)
}

//Used to get accounts either based on uuid
async function getAccountHelper(username, column, value) {
    if(username === undefined || value === undefined) {
        return undefined
    }

    let query = `
        SELECT * FROM Accounts
        WHERE username = ? AND ${column} = ?
    `

    let result = await connectionHelper(query, [username, value])

    //If result is undefined or nothing is returned from the query
    if (!result || result[0].length === 0) {
        return undefined
    }

    return result[0][0]
}

//Returns true if uuid matches username
//This is basically a way to check if the user is logged in
//or if they're larping as a different user
async function verifyAccountWithUUID(username, uuid) {
    let result = await getAccountWithUUID(username, uuid)

    if(result === undefined) {
        return false
    }

    //Result might still be an empty object {} that's why hasOwnProperty is used
    return result.hasOwnProperty("username")
}

async function isAdminAccount(username, uuid) {
    let query = `
        SELECT admin
        FROM Accounts
        WHERE username = ? AND uuid = ?
    `
    let result = await connectionHelper(query, [username, uuid])

    if(result === undefined) {
        return false
    }

    return await verifyAccountWithUUID(username, uuid) && result[0]
}

async function doesAccountExist(username) {
    let query = `
        SELECT *
        FROM Accounts
        WHERE username = ?
    `
    let result = await connectionHelper(query, [username])

    if(result === undefined) {
        return false
    }

    return result[0].length >= 1
}

async function createAccount(account) {
    let query = `
             INSERT INTO Accounts (username, uuid, password, creation_date, pfp_option, admin) VALUES
             (?, ?, ?, ?, ?, ?)`
    let params = [account.username, account.uuid, account.password, getCurrentDate(), account.pfp_option, false]

    let result = await connectionHelper(query, params)

    if(result === undefined) {
        return undefined
    }

    return await getAccountWithUUID(account.username, account.uuid)
}

async function isUsersPost(username, post_id) {
    if(isNaN(post_id)) {
        return false
    }

    let query = `
        SELECT * FROM Posts
        WHERE id = ? AND user_posted = ?
    `
    let result = await connectionHelper(query, [post_id, username])
    return !(result === undefined || result[0].length === 0);
}

async function isUsersComment(username, comment_id) {
    if(isNaN(comment_id)) {
        return false
    }

    let query = `
        SELECT * FROM Comments
        WHERE comment_id = ? AND user_commented = ?
    `
    let result = await connectionHelper(query, [comment_id, username])
    return !(result === undefined || result[0].length === 0);
}

async function isValidPostId(post_id) {
    if(isNaN(post_id)) {
        return false
    }

    let query = `SELECT * FROM Posts WHERE id = ?`
    let result = await connectionHelper(query, [post_id])

    return !(result === undefined || result[0].length === 0)
}

async function elevateToAdmin(username, uuid) {
    let query =
        `UPDATE Accounts 
         SET admin = TRUE
         WHERE username = ? AND uuid = ?`
    let params = [username, uuid]
    console.log(await connectionHelper(query, params))
}

//Checks to see if connection is established
async function isConnectedToDB() {
    try {
        const connection = await connPool.getConnection()
        connection.release()
        return true
    } catch (e) {
        return false
    }
}

async function connectionHelper(query, parameters) {
    try {
        const connection = await connPool.getConnection()
        let result = await connection.execute(query, parameters);
        connection.release()
        return result
    } catch (e) {
        console.log("Error Occurred: " + e.name)
        console.log(e.message)
        console.log(e.stack)
        return undefined
    }
}

module.exports = {
    getPost,
    getAmountOfPosts,
    addPost,
    editPost,
    getPage,
    deletePost,
    addComment,
    getCommentsForPost,
    deleteComment,
    getAccountWithUUID,
    getAccount,
    verifyAccountWithUUID,
    doesAccountExist,
    isAdminAccount,
    getAmountOfPages,
    createAccount,
    isUsersComment,
    isUsersPost,
    isValidPostId,
    getPostAndAccount,
    getEveryPost,
    searchKeywordInPosts,
    elevateToAdmin,
    isConnectedToDB,
    MAX_PER_PAGE
};