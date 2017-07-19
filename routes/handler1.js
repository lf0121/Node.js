//实现功能接口
//   前端  --》 数据，‘’ {} ，死的 
//   获取数据 ：后台 
//   接口 ： 方便前端 使用 ajax 调取数据
//    调取 数据  --》 后台  
//     后台  --> 数据库里面找到，得到的结果 --》 res返回给 前端
//              res.send(‘你好’)

// ajax  --> 使用接口  --》 包含我所要去使用的功能

// 接口的 逻辑   
var express = require('express'),
    router = express.Router(),
    handler = require('./dbhandler.js'),
    formidable = require('formidable'),
    crypto = require('crypto');
var StringDecoder = require('string_decoder').StringDecoder;
var decoder = new StringDecoder('utf8');
var images = require("images");
var fs = require('fs');
var ObjectID = require('mongodb').ObjectID;
function User(user) {
  this.id=user.id;
  this.name = user.name;
  this.password = user.password;
  this.veri = user.veri;
};
var flagInt = 0;
//迭代处理删除后的系统管理员各人员的tokenId
var recUpdate = function(req, res, collections,data){
  if(data.length===0){
    res.end('{"success":"删除成功"}');
  }else{
    var selectors = [
      {"userName":data[0].userName},
      {$set:
      {
        "tokenId":data[0].tokenId-1
      }
      }

    ];

    req.query.action = 'update';
    handler(req, res, collections, selectors,function(dat){

      data.shift();
     if(data.length!=0){
        //console.log(data);
        recUpdate(req, res, collections,data);
      }else{
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
*  */
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
// 第一天 ********************************************************************
//客户端获取验证码字符及校验验证码接口
router.get('/AdminLoginAndRegHandler',function(req, res){
  if(req.query.action==="verification"){
    var randomNum=function (min,max){//生成随机数
      return Math.floor( Math.random()*(max-min)+min);
    };
    var str = 'ABCEFGHJKLMNPQRSTWXY123456789';
    var returnStr = "";
    for(var i=0; i<4; i++){
      var txt = str[randomNum(0,str.length)];
      returnStr+=txt;
    }
    var newUser = new User({
            name: "",
            password:"",
            id:"",
            veri:returnStr
           });
      req.session.user = newUser;
        console.log("给session赋值");
      console.log(req.session);
    res.end('{"success":"true","data":"'+returnStr+'"}');
  }else if(req.query.action==="checkVerification"){
  	//检查验证码
    //console.log("从session中取值");
    //console.log(req.session);
    if(req.session.user&&req.query.veri===req.session.user.veri){
        res.end('{"success":"验证码正确"}');
      }else{
        res.end('{"err":"验证码错误"}');
      }
  }

});
//登录请求,添加系统人员verification
router.post('/AdminLoginAndRegHandler', function (req, res) {
  if(req.query.action=='login'){ //登录
    var md5 = crypto.createHash('md5');
    var password = md5.update(req.body.password).digest('base64');

    handler(req, res, "Administor", {userName: req.body.userName,password:password},function(data){
      console.log("77777777778");
      console.log(data);
      if(data.length===0){
        res.end('{"err":"抱歉，系统中并无该用户，如有需要，请向管理员申请"}');
      }else if(data.length!==0&&data[0].password===password){
        req.session.user.name = req.body.userName;
        req.session.user.password = password;
        req.session.user.id = data[0]._id;
        res.end('{"success":"true"}');
      }

    });

  }else{
    res.end('{"err":"抱歉，POST AdminLoginAndRegHandler下无此路由"}');
  }

});

//管理员列表(show,delete)
router.get('/AdminHandler',function(req,res){
  if(req.query.action=='add'){ //注册
    req.query.action='show'
    handler(req, res, "Administor", null,function(arr){
      var md5 = crypto.createHash('md5');
      //组织用户信息并作一些校验
      var userInfos = {};
      userInfos.createAt = new Date();
      userInfos.isdelete = /^fcgl/.test(req.body.turename)?false:true;
      userInfos.password =  md5.update(req.body.password).digest('base64');
      userInfos.phone =/^1\d{10}$/.test(parseInt(req.body.phone))?req.body.phone:'false';
      userInfos.power = req.body.power;
      userInfos.powerCode = req.body.power=="系统管理员"?1:2;
      userInfos.success = "成功";
      userInfos.tokenId = arr.length+1;
      userInfos.upDateAt = new Date();
      userInfos.userName = req.body.userName==""?'false':req.body.userName;
      userInfos.turename = req.body.turename==""?'false':req.body.turename;
      req.query.action='add'
      if( userInfos.phone!='false'&& userInfos.userName!='false'&&userInfos.turename!='false'){
        handler(req, res, "Administor",userInfos,function(data){
          //console.log(data);
          if(data.length==0){
            res.end('{"err":"抱歉，添加失败"}');
          }else{

            res.end('{"success":"注册成功"}');
          }
        });
      }else{
        res.end('{"err":"抱歉，添加失败"}');
      }


    });
  }else if(req.query.action=='show'){ //显示
    handler(req, res, "Administor", null,function(arr){
      console.log(req.query.searchText);
      var selector = !req.query.searchText?{tokenId:{$gt:arr.length-(parseInt(req.query.pageStart)*3-3)-3,$lte:arr.length-(parseInt(req.query.pageStart)*3-3)}}:{ turename: { $regex: '.*'+req.query.searchText+'.*', $options: 'i' } } ;
     console.log(selector);
      handler(req, res, "Administor",selector ,function(data){
        console.log(data);
        if(data.length==0){
          res.end('{"err":"抱歉，系统中查不到人员"}');
        }else{
          var obj = {
            data:{
              pageSize:3,
              count:arr.length,
              list:data
            }
          }
          var str = JSON.stringify(obj);
          res.end(str);
        }
      });
    });

  }else if(req.query.action=='delete'){ //删除
    //删除操作
    handler(req, res, "Administor",{tokenId:parseInt(req.query.tokenId),isdelete:true},function(data){
      //console.log(data);
      if(data.result.n==0){
        res.end('{"err":"删除失败"}');
      }else{
        req.query.action = 'show';
        //获取tokenId大于当前tokenId的数据集，并迭代处理管理员列表的tokenId
        handler(req, res, "Administor",{tokenId:{$gt:parseInt(req.query.tokenId)}},function(da){

          recUpdate(req, res,"Administor",da);
        });
        res.end('{"success":"更新成功"}');
      }
    });
  }else if(req.query.action=='lockuser'){  //锁定
  	// 学员锁定
    //获取与tokenId对应的该条数据
    req.query.action = 'show';
    handler(req, res, "studentList",{tokenId:parseInt(req.query.tokenId)},function(da){
      req.query.action = 'update';
      var selectors = [
        {tokenId:parseInt(req.query.tokenId)},
        {$set:
        {
          isstate:da[0].isstate?false:true
        }
        }

      ];
      //切换当前字段isstate的状态
      handler(req, res, "studentList", selectors,function(data){
        if(data){
          res.end('{"success":"操作成功"}');
        }else{

          res.end('{"err":"抱歉，冻结失败"}');
        }
      });
    });
  }else if(req.query.action=='quit'){ //退出
    if(req.session.user){
      req.session.user={};
    }
    res.end('{"success":"退出成功"}');

  }else{

    res.end('{"err":"抱歉，GET AdminHandler下无此路由"}');
  }
});
//管理员列表update  returnuserinfo  updatepass
router.post('/AdminHandler',function(req,res){
  if(req.query.action=='update'){  //修改
    var selectors = [
      {"tokenId":parseInt(req.body.tokenId)},
      {$set:
        {
          "userName":req.body.userName,
          "turename":req.body.turename,
          "phone":req.body.phone,
          "power":req.body.power,
          "upDateAt":new Date()
        }
      }

    ];
    //console.log(selectors);
    handler(req, res, "Administor", selectors,function(data){
      if(data.length==0){
        res.end('{"err":"抱歉，更新失败"}');
      }else{
        res.end('{"success":"更新成功"}');
      }
    });

    //登入后返回当前用户的详细信息
  }else if(req.query.action=='returnuserinfo'){
    console.log(req.session);
    req.query.action = 'find';
    //从session中拿去当前用户的用户名和密码
    var sessionUserName = req.session.user.name;
    var sessionPassword = req.session.user.password;
    var sessionId = new ObjectID(req.session.user.id);
    //console.log(sessionId);
    handler(req, res, "Administor", {"_id":sessionId},function(data){
      if(data.length==0||data.length>1){
        res.end('{"err":"抱歉，系统故障"}');
      }else{

        var str = JSON.stringify(data[0]);
        res.end(str);
      }

    });
  }else if(req.query.action=='updatepass'){//安全中心，修改密码
    //对原密码加密
    //console.log(req.body.userPwd);
   // console.log(req.session.user);
    var md5 = crypto.createHash('md5');
    var passwordMd5 = md5.update(req.body.userPwd).digest('base64');
    console.log(passwordMd5);
    //判断原密码是否正确
    if(req.session.user.password!=passwordMd5){
      res.end('{"err":"密码错误"}');
    }else{
      var md56 = crypto.createHash('md5');
     var newPwd = req.session.user.password = md56.update(req.body.newPwd).digest('base64');
      var selectors = [
        {"userName":req.session.user.name},
        {$set:
        {
          "password":newPwd,
          "upDateAt":new Date()
        }
        }

      ];
      //将同样加密过的新密码更新到数据库
      handler(req, res, "Administor", selectors,function(data){
        if(data.length==0){
          res.end('{"err":"密码更新失败"}');
        }else{
          res.end('{"success":"更新成功"}');
        }
      });
    }
    //添加学员信息
  }else if(req.query.action=='adduser'){
    req.query.action='usershow';
    //获取学员列表的数据总数
    handler(req, res, "studentList", null,function(arr){
      //组织学员信息并作一些校验
      var userInfos = {};
      userInfos.createAt = new Date();
      userInfos.email = /^([a-zA-Z0-9]+[_|\_|\.]?)*[a-zA-Z0-9]+@([a-zA-Z0-9]+[_|\_|\.]?)*[a-zA-Z0-9]+\.[a-zA-Z]{2,3}$/.test(req.body.addemail)?req.body.addemail:"数据格式不对";
      userInfos.isstate = false;
      userInfos.phone =/^1\d{10}$/.test(parseInt(req.body.addphone))?req.body.addphone:'false';
      userInfos.success = "成功";
      userInfos.userPwd = "123456";
      userInfos.tokenId = arr.length+1;
      userInfos.upDateAt = new Date();
      userInfos.userName = req.body.userName==""?'false':req.body.adduserName;
      req.query.action='adduser'
      if( userInfos.phone!='false'&& userInfos.userName!='false'&&userInfos.turename!='false'&&userInfos.email!="数据格式不对"){
        //增加操作
        handler(req, res, "studentList",userInfos,function(data){
          //console.log(data);
          if(data.length==0){
            res.end('{"err":"抱歉，添加失败"}');
          }else{

            res.end('{"success":"添加成功"}');
          }
        });
      }else{
        res.end('{"err":"抱歉，数据格式有误，添加失败"}');
      }


    });
    //  获取学员列表信息  多条件查询
  }else if(req.query.action=='usershow'){
    var selector={};    //如果为空 搜索框内则为空
    if(req.body.userName){    //如果姓名的搜索框有内容  储存在selector里面
      selector.userName={$regex:'.*'+req.body.userName+'.*'};
    }
    if(req.body.email){
      selector.email={$regex:'.*'+req.body.email+'.*'};
    }
    if(req.body.phone){
      selector.phone={$regex:'.*'+req.body.phone+'.*'};
    }
    //获取学员列表的数据总数
    handler(req, res, "studentList", null,function(arr){
     if(isNullObj(selector)){   //判断搜索框内是否为空
       selector={tokenId:{$gt:arr.length-(parseInt(req.body.pageStart)*6-6)-6,$lte:arr.length-(parseInt(req.body.pageStart)*6-6)}};
     }
      //查询数据库获取结果集
      handler(req, res, "studentList",selector ,function(data){
          var obj = {
            data:{
              pageSize:6,
              count:arr.length,
              list:data
            }
          }
          var str = JSON.stringify(obj);
          res.end(str);

      });
    });
  }else{
    res.end('{"err":"抱歉，POST,AdminHandler无此路由"}');
  }

});






module.exports = router;