const express = require("express");
const handlebars = require("express-handlebars");
const app = express();
const mongodbConnection = require("./configs/mongodb-connection");
const postService = require("./services/post-service");
const { ObjectId } = require("mongodb");
const bcrypt = require("bcryptjs");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.engine(
    "handlebars",
    handlebars.create({
        helpers: require("./configs/handlebars-helpers"),
    }).engine,
);
app.set("view engine", "handlebars");
app.set("views", __dirname + "/views");

app.get("/", async (req, res) => {
    const page = parseInt(req.query.page) || 1; // 현재 페이지 데이터
    const search = req.query.search || ""; // 검색어 데이터
    try {
        // postService.list 에서 글 목록과 페이지네이터를 가져옴
        const [posts, paginator] = await postService.list(collection, page, search);

        //리스트 페이지 렌더링
        res.render("home", { title: "테스트 게시판", search, paginator, posts });
    } catch (err) {
        console.error(err);
        res.render("home", { title: "테스트 게시판" });
    }
});

// 쓰기 페이지 이동
app.get("/write", (req, res) => {
    res.render("write", { title: "테스트 게시판", mode: "create" });
});

app.post("/write", async (req, res) => {
    const post = req.body;

    // 패스워드 해싱
    await postService.postHashingPassword(post);


    // 글쓰기 후 결과 반환
    const result = await postService.writePost(collection, post);

    // 생성된 도큐먼트의 _id를 사용해 상세페이지로 이동
    res.redirect(`/detail/${result.insertedId}`);
});

// 상세 페이지로 이동하기
app.get("/detail/:id", async (req, res) => {
    // 게시글 정보 가져오기
    const result = await postService.getDetailPost(collection, req.params.id)
    res.render("detail", {
        title: "테스트 게시판",
        post: result.value,
    });
});

// 패스워드 체크 API
app.post("/check-password", async (req, res) => {
    const { id, password } = req.body; // id와 prompt()함수에 입력된 password 가져옴

    try {
        // 데이터베이스에서 게시물 가져오기
        const post = await postService.getPostById(collection, id);

        // 게시물이 없으면 클라이언트에게 해당하는 메시지를 보내기
        if (!post) {
            return res.status(404).json({ isExist: false, message: '게시물이 존재하지 않습니다.' });
        }

        // 비밀번호 비교
        const isPasswordMatch = await bcrypt.compare(password, post.password);

        // 비밀번호가 맞으면 클라이언트에게 true를 보내기
        if (isPasswordMatch) {
            return res.json({ isExist: true });
        } else {
            // 비밀번호가 틀리면 클라이언트에게 false를 보내기
            return res.status(401).json({ isExist: false, message: '비밀번호가 일치하지 않습니다.' });
        }
    } catch (error) {
        // 에러 발생 시 클라이언트에게 적절한 에러 메시지 보내기
        console.error(error);
        return res.status(500).json({ isExist: false, message: '서버 오류' });
    }
});

// 수정 페이지, mode : modify
app.get("/modify/:id", async (req, res) => {
    try {
        // getPostById 함수는 Promise를 반환하므로 await 사용
        const post = await postService.getPostById(collection, req.params.id);
        res.render("write", { title: "테스트 게시판", mode: "modify", post });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});

// 글 수정하기
app.post("/modify/", async (req, res) => {
    const { id, title, writer, password, content } = req.body;

    const post = {
        title,
        writer,
        password,
        content,
        updatedDt: new Date().toISOString(),
    };
    await postService.postHashingPassword(post);
    // 업데이트 결과
    await postService.updatePost(collection, id, post);
    res.redirect(`/detail/${id}`);
});


// 글 삭제
app.delete("/delete", async (req, res) => {
    const { id, password } = req.body; // 프롬프트로 입력받은 패스워드

    try {
        // 데이터베이스에서 게시물 가져오기
        const post = await postService.getPostById(collection, id);

        // 게시물이 없으면 클라이언트에게 해당하는 메시지를 보내기
        if (!post) {
            return res.status(404).json({ isExist: false, message: '게시물이 존재하지 않습니다.' });
        }

        // 비밀번호 비교
        const isPasswordMatch = await bcrypt.compare(password, post.password);

        if(isPasswordMatch){
            // collection의 deleteOne을 사용해 게시글 하나를 삭제
            const result = await collection.deleteOne({ _id: ObjectId(id) });

            // 삭제 결과가 잘 못된 경우의 처리
            // deletedCount는 MongoDB에서 deleteOne 또는 deleteMany 작업을 수행한 후에 삭제된 문서의 수를 나타내는 속성
            if (result.deletedCount !== 1) {
             console.log("삭제 실패");
              return res.json({ isSuccess: false });
            }
            // 성공 한 경우
            res.json({ isSuccess: true });
        } else {
            console.log("비밀번호가 틀렸습니다.");
            return res.json({ isSuccess: false });
        }
    
    } catch (err) {
        console.error(err);
        return res.json({ isSuccess: false });
    }
});

// 댓글 추가
app.post("/write-comment", async (req, res) => {
    const { id, name, password, comment } = req.body;
    const post = await postService.getPostById(collection, id);
    const hashedPassword = await postService.hashingPassword(password);

    // 게시글에 기존 댓글 리스트가 있으면 추가
    if (post.comments) {
        post.comments.push({
            idx: post.comments.length + 1,
            name,
            hashedPassword,
            comment,
            createdDt: new Date().toISOString(),
        });
    } else { // 없으면
        post.comments = [
            {
                idx: 1,
                name,
                hashedPassword,
                comment,
                createdDt: new Date().toISOString(),
            }
        ]
    }

    // 업데이트 하기
    postService.updatePost(collection, id, post);
    return res.redirect(`/detail/${id}`)
});

// 댓글 삭제
app.delete("/delete-comment", async (req, res) => {
    const { id, idx, password } = req.body;

    try {
        // 게시글의 comments 안에 있는 특정 댓글 데이터를 찾기
        const post = await collection.findOne({
            _id : ObjectId(id),
            comments: { $elemMatch: { idx: parseInt(idx) } }
        });

        // 데이터가 없으면 isSuccess : false를 주면서 종료
        if (!post) {
            return res.json({ isSuccess: false });
        }

        const isPasswordMatch = await bcrypt.compare(password, post.comments[idx-1].hashedPassword);
        if(isPasswordMatch){
            post.comments = post.comments.filter((comment) => comment.idx !== +idx);
            postService.updatePost(collection, id, post);
            return res.json({ isSuccess : true });
        } else {
            return res.json({ isSuccess : false });
        }
    } catch (err) {
        console.error(err);
        return res.json({ isSuccess: false });
    }
});

let collection; // 사용할 DB 컬렉션 정보
app.listen(3000, async () => {
    console.log("server start");
    const mongoClient = await mongodbConnection();
    collection = mongoClient.db('board').collection('post');
    console.log("MongDB Connected");
});