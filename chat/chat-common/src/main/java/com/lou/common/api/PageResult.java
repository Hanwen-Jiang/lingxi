package com.lou.common.api;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Collections;
import java.util.List;

/**
 * 统一游标分页载荷(03-contracts.md §4):{@code {items,nextCursor,hasMore}}。
 * <p>用于历史/会话/好友/feed 列表。nextCursor 不透明(内部编码末条 id/时间);
 * 仅当确需总数的管理列表才用 offset 分页(另行约定)。
 *
 * @param <T> 列表元素类型
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PageResult<T> {

    private List<T> items;
    private String nextCursor;
    private boolean hasMore;

    public PageResult() {
    }

    public PageResult(List<T> items, String nextCursor, boolean hasMore) {
        this.items = items != null ? items : Collections.emptyList();
        this.nextCursor = nextCursor;
        this.hasMore = hasMore;
    }

    public static <T> PageResult<T> of(List<T> items, String nextCursor, boolean hasMore) {
        return new PageResult<>(items, nextCursor, hasMore);
    }

    /** 空页(无更多)。 */
    public static <T> PageResult<T> empty() {
        return new PageResult<>(Collections.<T>emptyList(), null, false);
    }

    public List<T> getItems() {
        return items;
    }

    public void setItems(List<T> items) {
        this.items = items;
    }

    public String getNextCursor() {
        return nextCursor;
    }

    public void setNextCursor(String nextCursor) {
        this.nextCursor = nextCursor;
    }

    public boolean isHasMore() {
        return hasMore;
    }

    public void setHasMore(boolean hasMore) {
        this.hasMore = hasMore;
    }
}
