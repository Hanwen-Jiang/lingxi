package com.lou.messagingservice.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.lou.messagingservice.model.BalanceLog;
import com.lou.messagingservice.service.BalanceLogService;
import com.lou.messagingservice.mapper.BalanceLogMapper;
import org.springframework.stereotype.Service;

/**
* @author loujun
* @description 针对表【balance_log(余额变动记录表)】的数据库操作Service实现
* @createDate 2025-06-14 20:29:14
*/
@Service
public class BalanceLogServiceImpl extends ServiceImpl<BalanceLogMapper, BalanceLog>
    implements BalanceLogService{

}




