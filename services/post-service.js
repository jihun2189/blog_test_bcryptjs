const paginator = require("../utils/paginator");
const { ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");

// 글쓰기
async function writePost(collection, post){
    // 생성일시와 조회수
    post.hits = 0;
    post.createdDt = new Date().toISOString(); // 날짜는 IOS포맷으로 저장
    return await collection.insertOne(post);
}

async function list(collection, page, search){
    const perPage = 10;

    // title이 search와 부분일치하는지 확인
    const query = { title : new RegExp(search, "i")} // i옵션은 대소문자를 구분하지 않음

    // limit는 10개만 가져온다는 의미, skip은 설정된 개수만큼 건너뛴다.
    // find(query, option)으로 구성 뒤에 sort()로 정렬도 가능, limit가 10이라 최대 10개 데이터만 찾음
    // skip은 1페이지 인 경우 0개 스킵해서 10개 가져오고 2페이지 인 경우 10개 스킵해서 11 ~ 20 까지 가져옴
    const cursor = collection.find(query, { limit: perPage, skip: (page -1) * perPage}).sort({
        createdDt : -1, // createdDt를 기준으로 내림차순 정렬
    })

    // 검색어에 걸리는 게시물의 총합
    const totalCount = await collection.count(query); // 검색어에 걸리는 게시물의 총 갯수, 페이지네이터에서 사용
    const posts = await cursor.toArray(); // 커서로 받아온 데이터를 리스트로 변경 

    // 페이지네이터 생성
    const paginatorObg = paginator({ totalCount, page, perPage: perPage });

    return [posts, paginatorObg];
}

// 패스워드는 노출 할 필요가 없으므로 결괏값으로 가져오지 않음
// 프로젝션은 쿼리 결과에서 특정 필드를 제외하거나 포함시킬 때 사용됨
// password와 comments 배열 안의 객체들의 password 필드를 제외하도록 설정
// 이렇게 설정된 projectionOption을 MongoDB의 find() 메서드와 함께 사용하면, 쿼리 결과에서 지정된 필드들이 제외된 결과를 얻을 수 있음
const projectionOption = {
    projection: {
        password: 0,
        "comments.password": 0,
    },
}

async function getDetailPost(collection, id){
    // 몽고디비 collection의 findOneAndUpdate() 함수 사용
    // 게시글을 읽을 때마다 hits를 1 증가
    // 첫번째 인자인 id로 해당 데이터를 찾고, 두 번째 인자로 어떤 변화를 줄지 정하고, 세 번째로 옵션을 줌
    return await collection.findOneAndUpdate({ _id : ObjectId(id)}, { $inc: {hits: 1} }, projectionOption); // $inc 는 필드의 값을 증가시킴
}

// id와 password로 게시글 가져오기, 글 수정하려고
async function getPostByIdAndPassword(collection, { id, password }){
   return await collection.findOne({_id : ObjectId(id), password: password})
}

// id로 데이터 불러오기
async function getPostById(collection, id){
    return await collection.findOne({_id : ObjectId(id)});
}

// 게시글 수정
async function updatePost(collection, id, post) {
    const toUpdatePost = {
        $set : {
            ...post,
        },
    };
    return await collection.updateOne({_id : ObjectId(id)}, toUpdatePost);
}

// 사용자가 입력한 비밀번호와 MongoDB에서 가져온 해싱된 비밀번호 비교
async function comparePasswords(plainPassword, hashedPasswordFromDatabase) {
    const isMatch = await bcrypt.compare(plainPassword, hashedPasswordFromDatabase);
    return isMatch;
}

async function postHashingPassword(post) {
    const hashedPassword = await bcrypt.hash(post.password, 10); // salt는 환경변수로 설정하면 좋을듯
    post.password = hashedPassword;
}

async function hashingPassword(password){
    return await bcrypt.hash(password, 10);
}

module.exports = {
    writePost,
    list,
    getDetailPost,
    getPostByIdAndPassword,
    getPostById,
    updatePost,
    comparePasswords,
    postHashingPassword,
    hashingPassword,
}