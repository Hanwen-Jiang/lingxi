package com.lou.messagingservice.mapper;

import com.lou.messagingservice.model.RedPacketReceive;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * @author loujun
 * @description 针对表【red_packet_receive(红包领取记录表)】的数据库操作Mapper
 * @createDate 2025-06-15 16:48:46
 * @Entity com.lou.messagingservice.model.RedPacketReceive
 */
public interface RedPacketReceiveMapper extends BaseMapper<RedPacketReceive> {

    /**
     *  根据红包ID查询领取记录
     * @param redPacketId  红包ID
     * @param pageNum      页码
     * @param pageSize     每页大小
     * @return  红包领取记录列表
     */
    @Select("SELECT * FROM red_packet_receive WHERE red_packet_id = #{redPacketId} LIMIT #{pageNum},#{pageSize}")
    List<RedPacketReceive> selectByRedPacketId(@Param("redPacketId") Long redPacketId,
                                               @Param("pageNum") Integer pageNum,
                                               @Param("pageSize") Integer pageSize);

}




