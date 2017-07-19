//实现功能接口
//   前端  --》 数据，‘’ {} ，死的 
//   获取数据 ：后台 
//   接口 ： 方便前端 使用 ajax 调取数据
//    调取 数据  --》 后台  
//     后台  --> 数据库里面找到，得到的结果 --》 res返回给 前端
//              res.send(‘你好’)

// ajax  --> 使用接口  --》 包含我所要去使用的功能
// 写接口  --》 配置道路由上面
// 接口的 逻辑   
var express = require('express'),   //*
    router = express.Router(),        //*
    handler = require('./dbhandler.js'),  //*   dbhandler.js 数据库操作的增删改查
    formidable = require('formidable'),
    crypto = require('crypto');     //  加密 ，
var StringDecoder = require('string_decoder').StringDecoder;
var decoder = new StringDecoder('utf8');
var images = require("images");
var fs = require('fs');
var ObjectID = require('mongodb').ObjectID;
//  定义了一个函数，用来收集用户的登录信息的  容器
function User(user) {
  this.id=user.id;   //暂时不考虑
  this.name = user.name;
  this.password = user.password;
  this.veri = user.veri;
//  veri  ==验证码
};
var flagInt = 0;
//迭代处理删除后的系统管理员各人员的tokenId
var recUpdate = function(req, res, collections,data){
  //   recUpdate(req,res,'Administor',da)   data=da 就是>删除数据的tokenId 的所有数据
  //                                   collections='Administor'
  //   二次修改                data（待修改结果集）=[{5},{6}]
  //  三次修改     data（待修改结果集）=[{6}]
  if(data.length===0){ // 删除的 是最后一条数据
    res.end('{"success":"删除成功"}');
  }else{   // 删除的 不是最后一条数据  ===》 修改 tokenId
    var selectors = [  // 修改条件  ？只修改了一条数据里面的 内容   data=[{4},{5},{6}]
      //  data[0]  第一个数据
      {"userName":data[0].userName},   //   保证注册的时候，用户名不要重复
      {$set:                                         // $inc  ---> 作业
      {
        //   修改 这组数据里面的 tokenId  -1
        "tokenId":data[0].tokenId-1
      }
      }
    ];

    req.query.action = 'update';  // 确定了 数据库的操作方式
    handler(req, res, collections, selectors,function(dat){
      //  data=[{3},{5},{6}]
      //  data（待修改结果集）=[{4},{6}]
      //  三次 data（待修改结果集）=[{5}]
      data.shift();    //  data（待修改结果集）=[{5},{6}]  二次 data（待修改结果集）=[{6}]  三次 data[]
     if(data.length!=0){
        //console.log(data);
        recUpdate(req, res, collections,data);  // 重新调用自身
      //   data（待修改结果集）=[{5},{6}]
      //   data（待修改结果集）=[{6}]
      }else{
       //  data（待修改结果集）=[]
        res.end('{"success":"更新成功"}');
      }
    });
  }
}
//迭代处理课程列表删除后的ID
var recUpdateID = function(req, res, collections,data,fn){
  if(data.length===0){
    res.end('{"success":"删除成功"}');
  }else{
    var selectors = [
      {"_id":data[0]._id},
      {$set:
      {
        "ID":data[0].ID-1
      }
      }

    ];
    //console.log(fn);
    req.query.action = 'update';
    handler(req, res, collections, selectors,function(dat){
      data.shift();
      if(dat.length==0){
        res.end('{"err":"抱歉，更新失败"}');
      }else if(data.length!=0){
        //console.log(data);
        recUpdateID(req, res, collections,data,fn);
      }else{

        if(fn){
          fn();
        }else{
          res.end('{"success":"更新成功"}');
        }

      }
    });
  }
}
//迭代删除目录绑定的视频
/*
*  dirID:目录_id
*  proID:课程_id
*  VstateName:课程名称
*  data  需要处理的视频数据集
* */
var delDirVideo = function(req, res, dirID,proID,VstateName,data,fn){
  var dirIDProName = dirID+proID ;
  if(data.length===0){
    fn();
  }else{
            req.query.action='find';
            //查询与课程ID对应的目录条数看与该课程绑定的目录是否只剩一条否则不改变videoList的Vstate字段
            handler(req, res, "directoryList", {"CDid":proID},function(set){
              //console.log(set);
              //拆分Vstate去除其中的已删除课程名
              var targetArrVstate = data[0].Vstate.split(",");
              if(set.length===1){
                var indexNumberVstate = (function(arr,val) {
                  for (var i = 0; i < arr.length; i++) {
                    if (arr[i] == val) return i;
                  }
                  return -1;
                })(targetArrVstate,VstateName);
                targetArrVstate.splice(indexNumberVstate,1);
              }
              //拆分Vmosaic去除其中的dirIDProName
              var targetArrVmosaic = data[0].Vmosaic.split(",");
              var indexNumberVmosaic = (function(arr,val) {
                for (var i = 0; i < arr.length; i++) {
                  if (arr[i] == val) return i;
                }
                return -1;
              })(targetArrVmosaic,dirIDProName);
              targetArrVmosaic.splice(indexNumberVmosaic,1);

              var selectors = [
                {"_id":data[0]._id},
                {$set:
                {
                  "Vstate":targetArrVstate.join(","),
                  "Vmosaic":targetArrVmosaic.join(",")
                }
                }

              ];
              //console.log(selectors);
              req.query.action='update';
              //更新视频列表对应数据的Vstate与Vmosaic字段
              handler(req, res, "videoList", selectors,function(da){
                data.shift();
                if(data.length==0){
                  fn();
                }else if(data.length!=0){
                  delDirVideo(req, res, dirID,proID,data,fn);

                }
              });
            });

  }
}
//迭代删除课程绑定的目录
/*
 proID 课程的_id
* */
var delProDir = function(req, res,proID,fn){
    req.query.action = 'find';
  //查询productList，获取对应ID的课程信息的_id和课程名
  handler(req, res, "productList",{_id:proID} ,function(das){
    //获取对应课程_id的目录集directoryList
    handler(req, res, "directoryList",{CDid:proID} ,function(da){
      if(da.length!==0){
        /*
         * /*
         *  dirID:目录_id
         *  proID:课程_id的拼合串
         *  VstateName:课程名称
         *  data  需要处理的视频数据集
         *
         var delDirVideo = function(req, res, dirID,proID,VstateName,data,fn){
         * */
        //获取第一个目录相关的视频集
        handler(req, res, "videoList",{ Vmosaic: { $regex: '.*'+da[0]._id+das[0]._id+'.*' } } ,function(daa){
          delDirVideo(req, res, da[0]._id,das[0]._id,das[0].Cname,daa,function(){
            //删除该目录
            req.query.action = 'delete';
            handler(req, res, "directoryList",{_id:da[0]._id} ,function(dat){
              req.query.action = 'find';
              //再次验证看该课程下是否还有目录，如果有就迭代处理
              handler(req, res, "directoryList",{CDid:proID} ,function(data){
                if(data.length===0){
                  fn();
                }else{
                  delProDir(req, res,proID,fn);
                }
              });
            });
          });

        });

      }else{
        fn();
      }
    });

  });


}
//判断对象是否为空
var isNullObj=function(obj){
  for(var i in obj){
    if(obj.hasOwnProperty(i)){
      return false;
    }
  }
  return true;
}
//生成课程代码
var generateCode = function(){
  var letters = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];
  var numbers = ['0','1','2','3','4','5','6','7','8','9'];
  var str = "";
  for(var i=0;i<8;i++){
    if(i<4){
      str+= letters.splice(parseInt(Math.random()*(letters.length)),1);
    }else{
      str+= numbers.splice(parseInt(Math.random()*(numbers.length)),1);
    }
  }
  return str;
}
// 函数 设计+调用    ---》上面只是设计，没有调用，他和没有一样

// localhost:3000/Vuehandler/aaaa?action=haha
// 前端发出的请求的地址     '/VueHandler/aaaa?action=haha'
router.get('/aaaa',function (req,res) {
  // res.send('这是我的响应')
    if(req.query.action==='haha'){  // 如果你真的是这个请求 VueHandler/aaaa?action=haha
      // req.query. 获取到get方式的 ?后面
      //  req.query.action   获取到 haha
      res.send('这是haha的接口')
    //    服务器给你一个 响应  '这是haha的接口'
    }
});

//  前端要去请求的接口是什么   请求什么数据，发挥什么功能 ---》 后台逻辑
// /VueHandler/AdminLoginAndRegHandler?action=verification

//  当前路径之下   localhost:8000/VueHandler/AdminLoginAndRegHandler--->执行里面的函数
router.get('/AdminLoginAndRegHandler',function (req,res) {
    // 门牌号码
    if(req.query.action==='verification'){  //房间号
     var randomNum=function (min,max) {     //生成随机数字   10   《10
          return Math.floor(Math.random()*(max-min)+min);
     };   // 网上 搜索一下 ： 冒泡排序
     var str='ABCDEFGHIGKLMNOPQRSTUVWXYZ0123456789';  //从这个字符串里面随机挑选出来多个字母，当验证码
        var returnStr='';
        for(var i=0;i<4;i++){
          var txt=str[randomNum(0,str.length)];
          returnStr+=txt;
        }
    //            var returnStr='存放了随机生成的4位数字';
        //用户信息 ---》 验证码 也属于用户信息
        var newUser=new User({  //收集 用户信息里面的验证码部分
            name:'',
            password:'',
            id:"",
            veri:returnStr
        });
    //    用户信息 储存在  session里面的
    //    session   req.session 得到了我要去储存的用户信息的这个地方
        req.session.user=newUser;   // session 就有了验证码的信息了
    //    生成验证码， 因为验证码是用户登录信息的一部分，所以
    //    又将验证按储存到了 req.session.
        res.end('{"success":"true","data":"'+returnStr+'"}')
    }else if(req.query.action==='checkVerification'){
        //   前端输入的验证码  === 后台生成的验证码(已经被储存到了 req.session.user)
        // 输入不相等的验证码的时候 ---》err  证明 接口走通、验证可以基本达到效果
        //  生成验证码  ----》 才会才在 req.session.user
        // 上来直接验证  ===》 req.session.user.veri  根本不存在   ---》err
        //req.session.user 用来验证 是否有 req.session.user
        if(req.session.user&&req.query.yanzheng===req.session.user.veri){
            res.send('{"success":"验证码正确"}')
        }else {
            res.end('{"err":"验证码错误"}')
        }
    }
});

// 登录  /VueHandler/AdminLoginAndRegHandler?action=login
router.post('/AdminLoginAndRegHandler',function (req,res,next) {

    if(req.query.action=='login'){     //login  -->find  dbhandler.js 里面
        // 登录功能   加密 前端发送过来的 密码
        var md5=crypto.createHash('md5');
        var password=md5.update(req.body.password).digest('base64'); //123   uted8*
        handler(req,res,'Administor',{userName:req.body.userName,password:password},function (data) {
            if(data.length===0){
                res.end('{"err":"抱歉！用户或密码无效"}')
            }else if(data.length!==0&&data[0].password===password){
            //    缺少一步  将登陆的信息 储存到session里面   没有 验证码的时候 就没有一个 name
            //       req.session.user.name=req.body.userName;
            //       req.session.user.password=req.body.password;
            //       req.session.user.id=data[0]._id;
                  // data=[{_id:123444,userName:haha}]
                // 1.找到 登录功能， 2.修改  3.触发接口  4.测试 --》 预加载外面放一个ajax，url(退出的)  get
                var newUser=new User({         // 只是为了查看退出功能 收集 用户信息里面的z账号密码部分
                    name:req.body.userName,   // 打  ----》 函数  构造函数
                    password:req.body.password,
                    id:data[0]._id
                });
                req.session.user=newUser;
                console.log(data);
                res.end('{"success":"true"}');
            //    前端 true  ===》 跳转到某一个页面
            }
        })
    }
    next()

})

// 注册的信息 很多的字段的，前端要发送到后台储存到数据库里面的信息也很多
// 这是用户信息，保密 ---》 psot
//   /VueHandler     /AdminLoginAndRegHandler   ?  action= add
// router.post('/AdminLoginAndRegHandler',function (req,res) {   //url
router.post('/AdminLoginAndRegHandler',function (req,res) {   //url

  if(req.query.action=='add'){

     req.query.action='haha';   // 查询数据库 --》 人员列表 --》arr.lenth
      handler(req,res,'Administor',null,function (arr) {  //执行数据库的操作
      //    arr 查询到的数据的结果（结果集）  handler===》 多看看？多打几遍
          var md5=crypto.createHash('md5');  // 设置加密的方式  ，md5
          var userInfor={};  // 收集 所有要添加到数据库里面的数据==>为了插入集合做准备
          userInfor.tokenId=arr.length+1; //到现在
          // tokenId  自增长  每次添加一个用户 +1
          userInfor.createAt=new Date();  //数据的创建时间
          userInfor.isdelete=/^fcgl/.test(req.body.trueName)?false:true;
      //     根据前端传过来的 trueName字段 ，判断，false, true
          userInfor.phone=/^1\d{10}$/.test(parseInt(req.body.phone))?req.body.phone:'false';
      //手机 1 10数字         使用正则表达式 匹配（ 从前端发送过来的数据：req.body）
          userInfor.power=req.body.power;  //人员的权限  --》 人员权限 系统管理人员，课程管理人员
          userInfor.powerCode=req.body.power=='系统管理人员'?1:2;
          userInfor.success='成功';
          userInfor.upDateAt=new Date();  //new Date();
          userInfor.userName=req.body.userName==''?'false':req.body.userName;
          //  看 userName 传进来的是不是空的
          // 假设前端传过来 userName3333 我将userName3333 赋值给userName
          // userInfor.userName 是用来 添加到数据库的
          userInfor.tureName=req.body.tureName==''?'false':req.body.tureName;
          /*
          *
          *   userName:'abc',
           password:'123456',
           trueName:'葫芦娃',
           phone:'12312312312',
           power:'系统管理人员'
          *
          *
          *
          *
          *
          * */

          userInfor.password=md5.update(req.body.password).digest('base64');
          // 'base64'
          // 我要添加的人员信息的 字段 到现在 就已经 组织完成了
          req.query.action='add';    //对于数据库的 操作方式了
          if(userInfor.phone!='false'&& userInfor.userName!='false'&&userInfor.trueName!='false'){
              // 正则表达式，===》 效验
              handler(req,res,'Administor',userInfor,function (data) { // 执行数据库操作
           //    data  ---> 我的结果
               if(data.length==0){
                 res.end('{"err":"失败"}')
               }else {
                 res.end('{"success":"注册成功"}')
               }
           })
          }
      })

  }
});

//  get  /VueHandler/AdminHandler?action=show
router.get('/AdminHandler',function (req,res) {
    if(req.query.action==='show'){  // 定义数据库的操作方式，只要有一个req.query.action 有了定义的操作方式，OK你就不需要再次去定义了
    //    欢迎你进入了显示接口
       handler(req,res,'Administor',null,function (arr) {
         //  查询操作     (姓名查询，分页控制)          4 条数据    第一页里面的数据  tokenID   4 3 2
       var  selector=!req.query.searchText?{tokenId:{$gt:arr.length-(parseInt(req.query.pageStart)*3-3)-3, $lte:arr.length-(parseInt(req.query.pageStart)*3-3)}}:{turename:{$regex:'.*'+req.query.searchText+'.*',$options:'i'}};
           //           搜索框是否为空   ?                        req.query.pageStart     <  tokenID <=   req.query.pageStart                                     如果搜索框里面有信息
         //如果 搜索框里面有内容   使用正则 --》 匹配 的到匹配的结果==》作为查询的条件
       console.log(selector);    // OK ---》 tokenID
       handler(req,res,'Administor',selector,function (data) {
           if(data.length==0){
               res.send('{"err":"抱歉找不到该人员"}')   //  *** must be a buffer or string
           }else {
               var obj={
                   data:{
                       pageSize:3,           //我规定的 一页能够显示几条数据
                       count:arr.length,   // 你不告诉他一共有多少条数据，让他自己去数
                       list:data            //  你请求的当前页的数据
                   }
               };
               var str=JSON.stringify(obj);
               res.send(str);             // 显示的  ---》 把得到的数据 显示在前端页面上
           }
       })
       })
    }else if(req.query.action=='delete'){    // 在添加数据的时候 --》 用户名字 不能冲突
    //    /VueHandler/AdminHandler?action=delete
    //    req.query.action=='delete'  定义了 读数据库的操作方式  是删除
handler(req,res,'Administor',{tokenId:parseInt(req.query.tokenId),isdelete:true},function (data) {
             console.log(data);
             console.log(req.query.tokenId);
             if(data.result.n==0){     //
                 res.end('{"err":"删除失败"}')
             }else {
             //    删除成功了     res.send("{'success':'成功删除'}")
             //    tokenId
             // 首先 定义操作方式  --》 查询
                 req.query.action='show';
             //    查询 tokenId > 当前删除的tokenId 的 所有数据
 handler(req,res,'Administor',{tokenId:{$gt:parseInt(req.query.tokenId)}},function (da) {
                 //     data 删除的数据
                 //    da  tokenId > 当前删除的tokenId 的 所有数据
                 //   让 da  里面的数据 的 tokenId  -1 --> update
                     recUpdate(req,res,'Administor',da)
                 });
                 res.end('{"success":"更新成功"}')
             }
         })
    }else if(req.query.action=='quit'){   // 已经登录
        if(req.session.user){      // 确认服务器储存了登陆的用户  ---》 确认你已经登陆了
            req.session.user={};   // session 储存的就是登录的用户的信息，也就是说 退出，只要清空session就可以了
        }
        res.end('{"success":"退出成功"}')
    }
});

router.post('/AdminHandler',function (req,res) {
//    /VueHandler/AdminHandler?action=update
    if(req.query.action==='update'){   // ==>dbhandle  修改的功能
        var selector=[    //修改的数据的具体内容
            {"tokenId":parseInt(req.body.tokenId)},   // 根据谁去修改
            {$set:   // 修改的时候 修改的内容 完全是 前端传入的
                {
                    'userName':req.body.userName,  //账号
                    'turename':req.body.turename, // 姓名
                    'phone':req.body.phone,    //电话
                    'power':req.body.power,   // 权限
                    'upDateAt':new Date()      // 更新日期
                }
            }
        ];
        // 数据库的操作 将实参 传入
        handler(req,res,'Administor',selector,function (data) {
            if(data.length==0){
                res.end('{"err":"抱歉修改失败"}')
            }else {
                res.end('{"success":"更新成功"}')
            }
        })
    }
});






module.exports = router;