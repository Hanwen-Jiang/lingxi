package com.lou.momentservice.data.createMoment;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * @ClassName CreateMomentResponse
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/21 19:55
 */

@Data
@Accessors(chain = true)
public class CreateMomentResponse {

    private Long momentId;

    private Long userId;

    private String text;

    private List<String> mediaUrls;
}
