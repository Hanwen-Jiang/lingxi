package com.lou.momentservice.data.createMoment;

import lombok.Data;
import lombok.experimental.Accessors;

import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import java.util.List;

/**
 * @ClassName CreateMomentRequest
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/21 19:56
 */


@Data
@Accessors(chain = true)
public class CreateMomentRequest {

    @NotEmpty(message = "用户ID不能为空")
    public String userId;

    private String text;

    private List<String> mediaUrls;


}
