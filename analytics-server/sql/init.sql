CREATE DATABASE IF NOT EXISTS jingjie_analytics
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE jingjie_analytics;

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '事件主键',
  event_name VARCHAR(64) NOT NULL COMMENT '事件名称',
  install_id CHAR(36) NOT NULL COMMENT '随机安装标识，用于 UV 去重',
  session_id CHAR(36) NOT NULL COMMENT '本次应用启动的会话标识',
  app_version VARCHAR(32) NOT NULL COMMENT '客户端应用版本号',
  platform VARCHAR(16) NOT NULL COMMENT '客户端运行平台',
  client_timestamp BIGINT UNSIGNED NOT NULL COMMENT '客户端上报的 Unix 毫秒时间戳',
  properties JSON NOT NULL COMMENT '事件白名单内的附加属性',
  page_path VARCHAR(128) GENERATED ALWAYS AS (
    JSON_UNQUOTE(JSON_EXTRACT(properties, '$.page'))
  ) STORED COMMENT 'page_show 事件的页面路径',
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '服务端接收时间',
  PRIMARY KEY (id),
  KEY idx_events_created_event (created_at, event_name),
  KEY idx_events_created_install (created_at, install_id),
  KEY idx_events_created_page (created_at, page_path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='净界客户端统计事件明细';
