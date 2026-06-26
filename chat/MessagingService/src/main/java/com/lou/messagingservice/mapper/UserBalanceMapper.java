package com.lou.messagingservice.mapper;

import com.lou.messagingservice.model.UserBalance;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

import java.math.BigDecimal;

/**
* @author loujun
* @description 针对表【user_balance(用户余额表)】的数据库操作Mapper
* @createDate 2025-06-14 20:28:34
* @Entity com.lou.messagingservice.model.UserBalance
*/
public interface UserBalanceMapper extends BaseMapper<UserBalance> {

    @Update("UPDATE user_balance SET balance = balance - #{amount}, updated_at = NOW() " +
            "WHERE user_id = #{userId} AND balance >= #{amount}")
    int deductBalance(@Param("userId") Long userId, @Param("amount") BigDecimal amount);

    @Update("UPDATE user_balance SET balance = balance + #{amount}, updated_at = NOW() WHERE user_id = #{userId}")
    int increaseBalance(@Param("userId") Long userId, @Param("amount") BigDecimal amount);
}




