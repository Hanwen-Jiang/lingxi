package com.lou.momentservice.data.getMomentList;

import lombok.Data;
import lombok.experimental.Accessors;

import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;

@Data
@Accessors(chain = true)
public class GetMomentListRequest {

    /**
     * 用户ID(路径参数)
     */
    @NotNull(message = "用户ID不能为空")
    private Long userId;

    /**
     * 时间参数，用于分页或时间筛选（查询参数）
     */
    @NotEmpty(message = "时间参数不能为空")
    private String time;
}
