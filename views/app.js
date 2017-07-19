// 引入模块
// 搭建服务器
// 引入配置好的路由
// 设置静态资源路径
var express = require('express');
var path = require('path');
// logo
var favicon = require('serve-favicon');
// 日志 http请求，输出日志，用了什么样的方法
var logger = require('morgan');
// 处理cookie，请求中的cookie
var cookieParser = require('cookie-parser');
// 解析请求 body
var bodyParser = require('body-parser');
// cookie--->浏览器 单个cookie储存的数据有限4K，一个网站最多保存20个cookie 不安全
// session--->服务器 储存重要信息（登录信息）
var session = require('express-session');
// 一次性 登录，用户的信息 跳转一次页面  显示就没有了
var flash = require('connect-flash');


// 配置好的路由文件index users
var index = require('./routes/index');//定义一个变量 引入的index
var users = require('./routes/users');//定义一个变量 引入的users

// 地址 浏览器   path路径
var url = require('url');



// 创建一个服务器
var app = express();

// view engine setup
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'jade');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

// 加载开头引入的模块
app.use(logger('dev'));//使用日志
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
//解析body请求 使用app.use();
// 处理cookie部分
app.use(cookieParser());

app.use(flash);
// 先cookieParser 再flash
app.all('*',function(req,res,next){
    // app.all 所有请求过来的时候，都需要使用function
    // function--->处理跨域，设置请求头，其他需要的部分都在底层处理完毕
    

})

// 储存用户信息
app.use(session({
    secret:'FCXYHT',                    //设置session签名
    name:'TCXYHT',
    cookie:{maxAge:80000000000000000},  //储存的时长
    resave:false,                       //每次请求都会设置session
    saveUninitialized:true              //默认值，不管有没有session，每次都会生成一个
}))

app.use(function(req,res,next){
    // 储存本地的变量，
    res.locals.users = req.session.users;
    var error = req.flash('error');
    var success = req.flash.apply('success');
    // res.locals
})






// 访问localhost:3000，加载index这个页面
app.use('/', index);
// 访问localhost:3000/users，加载users这个页面
app.use('/users', users);


// 设置静态资源路径
app.use(express.static(path.join(__dirname, 'public')));

// module.exports = app;
app.listen(3000);
