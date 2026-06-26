package com.lou.momentservice.service;

import com.lou.momentservice.data.createMoment.CreateMomentRequest;
import com.lou.momentservice.data.createMoment.CreateMomentResponse;
import com.lou.momentservice.data.deleteMoment.DeleteMomentRequest;
import com.lou.momentservice.data.deleteMoment.DeleteMomentResponse;
import com.lou.momentservice.data.getMomentList.GetMomentListRequest;
import com.lou.momentservice.data.getMomentList.GetMomentListResponse;
import com.lou.momentservice.model.Moment;
import com.baomidou.mybatisplus.extension.service.IService;

/**
 * @author Lou
 * @description 针对表【moment(朋友圈)】的数据库操作Service
 * @createDate 2025-06-21 20:06:02
 */
public interface MomentService extends IService<Moment> {

    CreateMomentResponse createMoment(CreateMomentRequest request) throws Exception;

    DeleteMomentResponse deleteMoment(DeleteMomentRequest request);

    Long getMomentOwnerId(Long momentId);

    GetMomentListResponse getMomentList(GetMomentListRequest request);


}
