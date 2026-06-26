package com.lou.messagingservice.mapper;

import com.lou.messagingservice.model.RedPacket;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
* @author loujun
* @description 针对表【red_packet(红包主表)】的数据库操作Mapper
* @createDate 2025-06-14 18:35:21
* @Entity com.lou.messagingservice.model.RedPacket
*/
public interface RedPacketMapper extends BaseMapper<RedPacket> {

    @Update("UPDATE red_packet SET remaining_amount = remaining_amount - #{amount}, " +
            "remaining_count = remaining_count - 1, " +
            "status = CASE WHEN remaining_count - 1 = 0 THEN #{claimedStatus} ELSE status END " +
            "WHERE red_packet_id = #{redPacketId} " +
            "AND status = #{unclaimedStatus} " +
            "AND remaining_count > 0 " +
            "AND remaining_amount >= #{amount}")
    int decreaseRemaining(@Param("redPacketId") Long redPacketId,
                          @Param("amount") BigDecimal amount,
                          @Param("unclaimedStatus") Integer unclaimedStatus,
                          @Param("claimedStatus") Integer claimedStatus);

    @Update("UPDATE red_packet SET status = #{refundingStatus} " +
            "WHERE red_packet_id = #{redPacketId} " +
            "AND status = #{unclaimedStatus} " +
            "AND expire_at <= #{now} " +
            "AND remaining_amount > 0")
    int markRefunding(@Param("redPacketId") Long redPacketId,
                      @Param("now") LocalDateTime now,
                      @Param("unclaimedStatus") Integer unclaimedStatus,
                      @Param("refundingStatus") Integer refundingStatus);

    @Update("UPDATE red_packet SET status = #{expiredStatus}, remaining_amount = 0, remaining_count = 0 " +
            "WHERE red_packet_id = #{redPacketId} AND status = #{refundingStatus}")
    int markRefunded(@Param("redPacketId") Long redPacketId,
                     @Param("refundingStatus") Integer refundingStatus,
                     @Param("expiredStatus") Integer expiredStatus);

    @Select("SELECT * FROM red_packet WHERE status = #{unclaimedStatus} AND expire_at <= #{now} LIMIT #{limit}")
    List<RedPacket> selectExpiredUnclaimed(@Param("now") LocalDateTime now,
                                           @Param("unclaimedStatus") Integer unclaimedStatus,
                                           @Param("limit") Integer limit);
}




