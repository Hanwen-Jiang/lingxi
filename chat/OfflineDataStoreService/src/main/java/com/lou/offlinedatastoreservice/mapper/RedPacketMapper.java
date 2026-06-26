package com.lou.offlinedatastoreservice.mapper;

import com.github.yulichang.base.MPJBaseMapper;
import com.lou.offlinedatastoreservice.model.RedPacket;
import org.apache.ibatis.annotations.Mapper;

/**
* @author loujun
* @description 针对表【red_packet(红包主表)】的数据库操作Mapper
* @createDate 2025-06-19 23:51:43
* @Entity com.lou.offlinedatastoreservice.model.RedPacket
*/
@Mapper
public interface RedPacketMapper extends MPJBaseMapper<RedPacket> {

}




