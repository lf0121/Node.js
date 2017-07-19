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
    handler = require('./dbhandler.js'),//数据库的增删改操作
    formidable = require('formidable'),//上传模块
    crypto = require('crypto');//加密模块
var StringDecoder = require('string_decoder').StringDecoder;
var decoder = new StringDecoder('utf8');
var images = require("images");
var fs = require('fs');
var ObjectID = require('mongodb').ObjectID;
// 收集用户登录信息 容器
function User(user) {
  this.id=user.id;
  this.name = user.name;
  this.password = user.password;
  this.veri = user.veri;
};
var flagInt = 0;
//迭代处理删除后的系统管理员各人员的tokenId
var recUpdate = function(req, res, collections,data){
  // recUpdate(req,res,'Administrator',da) 删除当前的数据 da结果集
  if(data.length==0){
    // 如果删除的是最后一条数据
    res.end('{"success":"删除成功"}');
  }else{
    // 如果删除的不是最后一条数据
    var selectors = [
      // 修改条件
      {"userName":data[0].userName},  //保证注册的时候 用户名不重复
      {$set:
        {
          // 修改这组数据里面的tokenId 依次-1
          "tokenId":data[0].tokenId-1
        }
      }
    ];

    req.query.action = 'update'; //确定数据库的操作方式
    handler(req, res, collections, selectors,function(dat){

      data.shift(); //处理过的就过滤，剩下没有处理的结果集
     if(data.length != 0){
        //console.log(data);
        // 处理过滤出来的，待处理的结果集
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
      {"_id":data[0]._id},  //选择，根据ID来改变tokenId让其依次-1
      {$set:    //设置删除方式
        {
          "ID":data[0].ID-1   //让结果集里面的ID依次-1
        }
      }

    ];
    //console.log(fn);
    req.query.action = 'update';
    handler(req, res, collections, selectors,function(dat){
      data.shift();   //过滤已经处理过的结果集
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
      return false;   //检测对象是否为空
    }
  }
  return true;    //自身没有属性
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


// 前端请求的接口 请求什么数据，发挥什么功能--->逻辑
// /VueHandler/AdminLoginAndRegHandler?action=verification
router.get('/AdminLoginAndRegHandler',function(req,res){
  if(req.query.action==='verification'){
    // 输出为json格式
    // res.send("{success:'验证码通了',status:0}");
// ******************************************************************************************************************
    // 生成验证码
    var randomNum = function(min,max){
      return Math.floor(Math.random()*(max-min)+min)
    };
    // 随机挑选验证码
    var str = 'ABCDEFGHIJKLMNOPQRSTUVWSYZ0123456789';
    var returnStr = '';
    for(var i=0;i<4;i++){
      var txt = str[randomNum(0,str.length)];
      returnStr += txt;
    }
    // 用户信息 验证码也属于用户信息
    var newUser = new User({
      // 收集用户信息里面的验证码部分
      name:'',
      password:'',
      id:'',
      veri:returnStr
    });
    // 用户信息储存在session里
    // req.session得到了我要去储存用户信息的地方
    req.session.user = newUser;  //有了验证码的信息了
    // 生成验证码，储存到了session

    // way:1
    res.send('{success:"true",data:"'+returnStr+'"}')
    
    // way:2
    // var data = {
    //   success:true,
    //   data:returnStr
    // }
    // res.send(eval("("+data+")"));



    
  }else if(req.query.action=='checkVerification'){
    // /VueHandler/AdminLoginAndRegHandler?action="checkVerification"
    // 校验验证码
    // 如果前端输入的验证码=后台生成的验证码
    // 生成验证码后 才会存在req.session.user.veri
    if(req.query.veri==req.session.user.veri){
      res.send("{success:'验证码对哒！'}")
    }else{
      res.send("{err:'验证码错了哒！'}")
    }
  }
});

// ****************************************************************************************************
// 登录
// /VueHandler/AdminLoginAndRegHandler?action=login
// 校对 find()--->userName password(注册的人员信息里面)
router.post('/AdminLoginAndRegHandler',function(req,res){
  if(req.query.action=='login'){
    // 登录功能 加密前端发送的密码
    var md5 = crypto.createHash('md5');
    var password = md5.update(req.body.password).digest('base64');

    // let password = req.body.password;

    
    handler(req,res,'Administrator',{userName:req.body.userName,password:password},function(data){
      if(data.length==0){
        res.send("{err:'用户或密码无效'}")
      }else if(data.length != 0 && data[0].password==password){
        // 还缺少 将登录的信息 储存到session里面
        // req.session.user.name = req.body.userName;
        // req.session.user.password = req.body.password;
        // req.session.user.id = data[0]._id;
        // 查看退出功能临时写的
        var newUser = new User({
          // 收集用户信息里面的验证码部分
          name:req.body.userName,
          password:req.body.password,
          id:data[0]._id
        });
        req.session.user=newUser;
        // console.log(data);
        res.send("{success:'对咯'}");
      }
    })
  }
})

// ********************************************************************************************************
// 修改信息
// /VueHandler/AdminHandler?action=update
router.post('/AdminHandler',function(req,res){
  if(req.query.action=='update'){
    var selector = [
      {'tokenId':parseInt(req.body.tokenId)},
      {$set:
        // 修改的内容是前端传入的
        {
          "userName":req.body.userName,
          "truename":req.body.trueName,
          "phone":req.body.phone,
          "power":req.body.power,
          "upDateAt":new Date()
        }
      }
    ];
    handler(req,res,'Administrator',selector,function(data){
      if(data.length==0){
        res.send("{err:'修改失败'}")
      }else{
        res.send("{success:'修改好哒！'}")
      }
    })
    
// ****************************************************************************************************
    // 返回登录的用户信息
    // /VueHandler/AdminHandler?action=returnuserinfo
  }else if(req.query.action=='returnuserinfo'){
      console.log(req.session);   //储存的用户信息
      req.query.action='find';
      // 从session里面取到当前登录的用户信息
      // var sessionUserName = req.session.user.name;
      // var sessionPassword = req.session.user.password;
      var sessionId = new ObjectID( req.session.user.id );
      handler(req,res,'Administrator',{'_id':sessionId},function(data){
        if(data.length==0){
          res.send("{err:'抱歉，系统有毛病'}")
        }else{
          var str = JSON.stringify(data[0]);
          res.send(str);
        }
      })
// *************************************************************************************************************
      // 修改密码
      // /VueHandler/AdminHandler?action=updatepass
  }else if(req.query.action=='updatepass'){
    var md5 = crypto.createHash('md5');
    var passwordMd5 = md5.update(req.body.userPwd).digest('base64');
    console.log(passwordMd5);
    // 判断输入的密码 跟登录的密码是不是一样的
    if(req.session.user.password != req.body.userPwd){
      res.send("{err:'娃儿，密码错咯'}")
    }else{
      var md5 = crypto.createHash('md5');
      var newPwd = md5.update(req.body.newPwd).digest('base64');
      // 修改数据库里面的密码
      var selector = [
        {"userName":req.session.user.name},   //  根据当前登录的账号，修改对应的数据库里面的信息
        {$set:
            {
              'password':newPwd,
              'upDateAt':new Date()
            }
        }
      ];
      // 执行数据库操作
      handler(req,res,'Administrator',selector,function(data){
        if(data.length==0){
          res.send("{err:''娃儿，密码更新错哒}")
        }else{
          res.send("{success:'好嘛，密码修改成功'}")
        }
      })
    }
// *************************************************************************************************************************
    // 添加学员注册信息
    // /VueHandler/AdminHandler?action=adduser
  }else if(req.query.action=='adduser'){
    req.query.action='find';    //定义数据库的操作方式   查询
    handler(req,res,'studentList',null,function(arr){
      var userInfors = {};
      userInfors.tokenId = arr.length+1;
      userInfors.createAt = new Date();
      userInfors.userName = req.body.userName == ""?'false':req.body.userName;
      userInfors.userPwd = '123456';
      userInfors.isstate = false;
      userInfors.upDateAt = new Date();
      userInfors.success = '成功';  //angular里面的字段
      userInfors.phone = /^1\d{10}$/.test(parseInt(req.body.addphone))?req.body.addphone:'false';
      userInfors.email = /^([a-zA-Z0-9]+[_|\_|\.]?)*[a-zA-Z0-9]+@([a-zA-Z0-9]+[_|\_|\.]?)*[a-zA-Z0-9]+\.[a-zA-Z]{2,3}$/.test(req.body.addemail)?req.body.addemail:"邮箱格式不对";
      // 将数据储存到数据库里面 添加
      req.query.action='add';
      // 校验 phone userName  email
      if(userInfors.phone != 'false' && userInfors.userName != 'false' && userInfors.email != '邮箱格式不对'){
        // 执行添加操作 --->  前端发送的数据都得到了，数据格式正确
        // res.send("{success:'搞好了'}")
        handler(req,res,'studentList',userInfors,function(data){
          if(data.length==0){
            res.send("{err:'学员添加失败'}")
          }else{
            res.send("{success:'添加好咯'}")
          }
        })
      }else{
        // 数据错误，不能添加
        res.send("{err:'格式错误'}")
      }
    })
//***********************************************************************************************************************************
  //  获取学员列表信息  多条件查询
  //  /VueHandler/AdminHandler?action=usershow  POST方式查询
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
})

// ******************************************************************************************************
// 注册信息
// 这是用户信息，保密 ---> post
//  /VueHandler/AdminLoginAndRegHandler?action=add
router.post('/AdminLoginAndRegHandler',function(req,res){
  if(req.query.action === 'add'){
    // res.send('{success:"登录接口"}');
    req.query.action = 'show';//查询数据库---> 人员列表 ---> arr.length
    handler(req,res,'Administrator',null,function(arr){
      // 加密方式
      var md5 = crypto.createHash('md5');
      // 查询到的数据的结果（结果集）
      var userInfor = {}; //收集所有要添加到数据库里面的数据
      userInfor.tokenId = arr.length+1;
      // 数据的创建时间
      userInfor.createAt = new Date();
      // isdelete根据前端传来的trueName进行判断，false,true
      userInfor.isdelete = /^fcgl/.test(req.body.trueName)?false:true;
      // req.body使用post请求时候，包含的数据
      userInfor.phone = /^1\d{10}$/.test(parseInt(req.body.phone))?req.body.phone:'false';
      userInfor.power = req.body.power;
      userInfor.powerCode = req.body.power=='系统管理人员'?1:2;
      userInfor.success = '成功';
      userInfor.upDateAt = new Date();
      userInfor.userName = req.body.userName==''?'false':req.body.userName;
      userInfor.trueName = req.body.trueName==''?'false':req.body.trueName;
      userInfor.password = md5.update(req.body.password).digest('base64');//加密方式base64固定的
      req.query.action='add';//定义数据库的操作方式
      if(userInfor.phone != 'false' && userInfor.userName != 'false' && userInfor.trueName != 'false'){
        handler(req,res,'Administrator',userInfor,function(data){
          // data 结果
          if(data.length==0){
            res.send('{"err":"失败"}');
          }else{
            res.end("{success:'注册好哒'}")
          }
        })
      }
    })
  }
})

// **********************************************************************************************************
//  显示人员列表
// /VueHandler/AdminHandler?action=show
router.get('/AdminHandler',function(req,res){
  if(req.query.action=='show'){
    //定义数据库的操作方式，只要有一个req.query.action 就不需要再定义了
    // 进入到显示接口
    handler(req,res,'Administrator',null,function(arr){
      // 查询操作（姓名，分页控制）
      //  一页里面显示多少数据，每一页应该显示什么数据
      var selector =! req.query.searchText?{tokenId:{
        // 搜索框是否为空
        // $gt:arr.length-(parseInt(req.query.pageStart)*3-3)-3, ===>a
        // $lte:arr.length-(parseInt(req.query.pageStart)*3-3)}} ===>b
        // {trueName:{$regex:'.*'+req.query.searchText+'.*',$options:'i'}} ===>c
        // a,b:c
        $gt:arr.length-(parseInt(req.query.pageStart)*3-3)-3,
        $lte:arr.length-(parseInt(req.query.pageStart)*3-3)}}:
        // 搜索框内部为空，正则匹配姓名 ‘ .* ’ 
        {trueName:{$regex:'.*'+req.query.searchText+'.*',$options:'i'}};
        console.log(selector);
        handler(req,res,'Administrator',selector,function(data){
          if(data.length==0){
            res.send("{err:'没找到'}")
          }else{
            // 没有查询操作
            var obj = {
              data:{
                pageSize:3,
                count:arr.length,
                list:data
              }
            };
            var str = JSON.stringify(obj);
            res.send(str);
          }
        })
    })
    // ************************************************************************************************************
    //  删除接口
    // /VueHandler/AdminHandler?action=delete
  }else if(req.query.action=='delete'){
    // req.query.action=='delete' 定义数据库的操作方式
    // 条件 根据tokenId来删除 tokenId:req.query.tokenId
    handler(req,res,'Administrator',{tokenId:parseInt(req.query.tokenId),isdelete:true},function(data){
      if(data.result.n==0){
        res.send("{err:'删除失败'}")
      }else{
        // 定义操作方式
        req.query.action='show';
        // 查询当前删除的tokenId的所有数据
        handler(req,res,'Administrator',{tokenId:{$gt:parseInt(req.query.tokenId)}},function(data){
          // data 是tokenId 大于当前删除的所有的数据
          // 迭代
          recUpdate(req,res,'Administrator',data)
        });
        res.send("{success:'删除成功'}")
      }
    })
  }else if(req.query.action=="quit"){
    if(req.session.user){
      req.session.user={};  //清空登录信息
    }
    res.send("{success:'退出成功'}")
// *************************************************************************************************************
  // 冻结，解冻
  // /VueHandler/AdminHandler?action=lockuser
  }else if(req.query.action=='lockuser'){
    req.query.action='show';  //查询数据库
    handler(req,res,'studentList',{tokenId:parseInt(req.query.tokenId)},function(data){
      // 测试
      // 修改数据 data里面的isstate  变成false true
      req.query.action='update';
      // 确定selector[{条件}，{内容}]
      var selector = [
        {tokenId:parseInt(req.query.tokenId)},
        {$set:
          {
            isstate:data[0].isstate?false:true
          }
        }
      ];
      // 执行的操作
      // 验证 在测试页面
      handler(req,res,'studentList',selector,function(data){
        if(data){
          res.send("{success:'成功冻结'}")
        }else{
          res.send("{err:'冻结失败'}")
        }
      })
    })
  }else{
    res.send("{err:'娃儿，没得这个路由哦'}")
  }
});

// ***********************************************************************************************************************
// 上传视频
// /VueHandler/UpLoadVideoHandler
router.post('/UpLoadVideoHandler',function(req,res){
  console.log("我进来咯");
  // 上传 ---> 模块 formidable
  var form = new formidable.IncomingForm(); //创建一个上传表单
  // 配置--->限制
  form.encoding = 'utf-8';
  // 上传的路径指的是 服务器所在的路径 就是在最外面的
  form.uploadDir = 'temporary/video/';
  form.keepExtensions = true; //保留文件尾缀  ***.mp4 ***.avi
  form.maxFieldsSize = 100*1024*1024; //文件尺寸
  form.maxFields = 1000;
  form.parse(req,function(err,fields,files){
    console.log(fields);
    console.log("*******************************");
    console.log(files);
    console.log("*******************************");
    if(!err){
      var obj = {
        cacheName:files[Object.getOwnPropertyNames(files)[0]].path,
        success:'成功了'
      }
      var str = JSON.stringify(obj);
      res.send(str);
    }else{
      var obj = {
        err:'FBI warning'
      }
      var str = JSON.stringify(obj);
      res.send(str);
    }
  })
})

// ***********************************************************************************************************************************
// 添加视频
// /VueHandler/VideoHandler?action=add
router.post('/VideoHandler',function(req,res){
  if(req.query.action=='add'){
    // res.send("{ok:'通了'}")
    // 逻辑
    req.query.action = 'find';
    handler(req,res,'videoList',null,function(arr){
      var videos = {};
      videos.Vname = req.body.Vname; //名字
      videos.Vtime = req.body.Vtime; //时长
      videos.Vurl = req.body.Vurl;  //地址
      videos.ID = arr.length+1; //相当于tokenId
      videos.Vstate = ''; //视频是否被绑定
      videos.createAt = new Date();
      videos.upDateAt = new Date();

      // 以后的二次开发
      videos.isFinish = false;
      videos.isViewed = false;

      // 信息收集完毕--->添加
      if(videos.Vname && videos.Vtime && videos.Vurl){
        req.query.action='add';
        handler(req,res,'videoList',videos,function(data){
          if(data.length==0){
            res.send("{err:'视频添加失败'}")
          }else{
            var obj = {
              ID:parseInt(data.ops[0].ID),
              Vurl:data.ops[0].Vurl,
              success:'插好了！'
            };
            var str = JSON.stringify(obj);
            res.send(str);
          }
        })
      }
    })
// ****************************************************************************************************************************
// 修改视频
// /VueHandler/VideoHandler?action=update
  }else if(req.query.action=='update'){
    req.query.action = 'find';
    handler(req,res,'videoList',{ID:parseInt(req.body.ID)},function(data){
      if(data.length==0){
        res.send("{err:'没有你想要的视频'}")
      }else{
        // data是查询到的已经上传的视频，如果修改了路径，相当于删除了之前的文件
        if(data[0].Vurl != req.body.Vurl){  //修改了上传的路径
          // req.body.Vurl 前端发送的路径
          // data[0].Vurl 数据库储存的路径
          // 相当于删除了以前的文件
          fs.unlink(data[0].Vurl,function(err){
            if(err) return console.log(err)
          })
        }
        var selector = [
          {'ID':parseInt(req.body.ID)},   //查询的条件
          {'$set':                        //修改的内容
              {
                Vname:req.body.Vname,
                Vtime:req.body.Vtime,
                Vurl:req.body.Vurl,
                upDateAt:new Date()
              }
          }
        ]
        req.query.action = 'update';
        handler(req,res,'videoList',selector,function(data){
          if(data.length==0){
            res.send("{err:'视频更新失败'}")
          }else{
            res.send("{ok:'视频更新好咯！'}")
          }
        })
      }
    })
// *****************************************************************************************************************************
// 视频列表请求 查询
// /VueHandler/VideoHandler?action=showlist
  }else if(req.query.action=='showlist'){
    // searchText: GLOBAL.searchbox.down("#name").getValue(),
    // pageStart: pageStart ? pageStart : 1
    var selector={};  //放置查询条件的容器
    //如有模糊查询条件则以其为筛选器
    if(req.body.searchText){  //搜索框内的内容
      selector.Vname={$regex:'.*'+req.body.searchText+'.*'};
    }
    //查询videoList列表获得总数据条数
    handler(req, res, "videoList", null,function(arr){
      if(isNullObj(selector)){
        selector={ID:{$gt:arr.length-(parseInt(req.body.pageStart)*3-3)-3,$lte:arr.length-(parseInt(req.body.pageStart)*3-3)}};
      }
      //根据筛选器查询videoList获得结果集
      handler(req, res, "videoList",selector ,function(data){
        if(data.length==0){
          res.end('{"err":"系统中还没有视频"}');
        }else{
          var obj = {
            data:{
              pageSize:3,
              count:arr.length,
              list:data,
              pageStart:req.body.pageStart
            },
            success:"成功"
          }
          var str = JSON.stringify(obj);
          res.end(str);
        }
      });
    });
  }else{
    res.end('{"err":"抱歉，视频管理失败"}');
  }
})
// ********************************************************************************************************************************************
// 删除视频
router.get('/VideoHandler',function(req,res){
  if(req.query.action=='delete'){
    req.query.action='find';
    //根据ID查询当前视频document获得当前视频的Vurl字段
    handler(req, res, "videoList",{ID:parseInt(req.query.ID)} ,function(data){
      if(data.length==0){
        res.end('{"err":"抱歉，系统中查不到该视频"}');
      }else{
          //删除系统中该视频文件
          fs.unlink(data[0].Vurl, function (err) {
            if (err) return console.log(err);
          });
        req.query.action='delete';
        //删除数据库中与该视频对应的数据
        handler(req, res, "videoList",{ID:parseInt(req.query.ID)},function(data){
          if(data.result.n==0){
            res.end('{"err":"删除失败"}');
          }else{
            req.query.action = 'find';
            //迭代处理其余视频文件的操作手柄-ID均减1
            handler(req, res, "videoList",{ID:{$gt:parseInt(req.query.ID)}},function(da){
              recUpdateID(req, res,"videoList",da);
            });
            res.end('{"success":"删除成功"}');
          }
        });
      }
    });
  }
});

// ******************************************************************************************************
// 权限数据请求
// /VueHandler/CourseHandler?action=getpower
router.get('/CourseHandler',function(req,res){
  // 登录之后获取当前账号的权限
  if(req.query.action=='getpower'){
    handler(req,res,'powers',null,function(data){
      if(data.length==0){
        var obj = {
          err:'权限错了',
          data:data
        };
        var str = JSON.stringify(obj);
        res.send(str);
      }else{
        var obj = {
          ok:'成功了！',
          data:data
        };
        var str = JSON.stringify(obj);
        res.send(str);
      }
    })
// *************************************************************************************************************************
// 获取课程权限
// /VueHandler/CourseHandler?action=getcategory
  }else if(req.query.action=='getcategory'){
    handler(req,res,'catalogList',null,function(){
      if(data.length==0){
        res.send("{err:'你没有权限'}")
      }else{
        var obj = {
          data:data,
          ok:'修改权限成功！'
        };
        var str = JSON.stringify(obj);
        res.send(str);
      }
    })
  }
});



// ******************************************************************************************************

module.exports = router;