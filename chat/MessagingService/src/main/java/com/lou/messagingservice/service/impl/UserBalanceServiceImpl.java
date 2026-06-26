package com.lou.messagingservice.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.messagingservice.model.UserBalance;
import com.lou.messagingservice.service.UserBalanceService;
import com.lou.messagingservice.mapper.UserBalanceMapper;
import org.springframework.stereotype.Service;

/**
* @author loujun
* @description 针对表【user_balance(用户余额表)】的数据库操作Service实现
* @createDate 2025-06-14 20:28:34
*/
@Service
public class UserBalanceServiceImpl extends ServiceImpl<UserBalanceMapper, UserBalance>
    implements UserBalanceService{

}




