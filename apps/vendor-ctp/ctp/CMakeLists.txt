cmake_minimum_required(VERSION 3.0.0)
project(ctp)
set(CMAKE_CXX_STANDARD 11)
# set(CMAKE_BUILD_TYPE Debug)

find_package(Iconv REQUIRED)
find_package(PkgConfig REQUIRED)

pkg_check_modules(ZMQ REQUIRED IMPORTED_TARGET libzmq)

set(CTP_BUILD_VARIANT "prod" CACHE STRING "Target environment (prod, cp, demo)")
set_property(CACHE CTP_BUILD_VARIANT PROPERTY STRINGS prod cp demo)

# 头文件目录
include_directories(${PROJECT_SOURCE_DIR}/include)

# 设置rpath
set(CMAKE_SKIP_BUILD_RPATH FALSE)
set(CMAKE_BUILD_WITH_INSTALL_RPATH FALSE)

# 库文件目录
if (CTP_BUILD_VARIANT STREQUAL "demo")
    set(CMAKE_BUILD_RPATH "\$ORIGIN/../../lib-demo")
    find_library(CTP_TRADER_LIB NAMES thosttraderapi_se PATHS ${PROJECT_SOURCE_DIR}/lib-demo NO_DEFAULT_PATH)
    find_library(CTP_MD_LIB NAMES thostmduserapi_se PATHS ${PROJECT_SOURCE_DIR}/lib-demo NO_DEFAULT_PATH)
    message(STATUS "CTP_TRADER_LIB: ${CTP_TRADER_LIB}")
    message(STATUS "CTP_MD_LIB: ${CTP_MD_LIB}")
elseif (CTP_BUILD_VARIANT STREQUAL "cp")
    set(CMAKE_BUILD_RPATH "\$ORIGIN/../../lib-cp")
    find_library(CTP_TRADER_LIB NAMES thosttraderapi_se PATHS ${PROJECT_SOURCE_DIR}/lib-cp NO_DEFAULT_PATH)
    find_library(CTP_MD_LIB NAMES thostmduserapi_se PATHS ${PROJECT_SOURCE_DIR}/lib-cp NO_DEFAULT_PATH)
    message(STATUS "CTP_TRADER_LIB: ${CTP_TRADER_LIB}")
    message(STATUS "CTP_MD_LIB: ${CTP_MD_LIB}")
else()
    set(CMAKE_BUILD_RPATH "\$ORIGIN/../../lib")
    find_library(CTP_TRADER_LIB NAMES thosttraderapi_se PATHS ${PROJECT_SOURCE_DIR}/lib NO_DEFAULT_PATH)
    find_library(CTP_MD_LIB NAMES thostmduserapi_se PATHS ${PROJECT_SOURCE_DIR}/lib NO_DEFAULT_PATH)
    message(STATUS "CTP_TRADER_LIB: ${CTP_TRADER_LIB}")
    message(STATUS "CTP_MD_LIB: ${CTP_MD_LIB}")
endif()

message(STATUS "CMAKE_BUILD_RPATH: ${CMAKE_BUILD_RPATH}")

# 源文件列表存储进SRC变量
aux_source_directory(${PROJECT_SOURCE_DIR}/src SRC)

# 生成可执行文件
set(CTP_TARGET_NAME "main_linux")
if (CTP_BUILD_VARIANT STREQUAL "demo")
    set(CTP_TARGET_NAME "${CTP_TARGET_NAME}_demo")
elseif (CTP_BUILD_VARIANT STREQUAL "cp")
    set(CTP_TARGET_NAME "${CTP_TARGET_NAME}_cp")
endif()

add_executable(${CTP_TARGET_NAME} ${SRC})

# 链接动态库
# target_include_directories(main_linux PRIVATE PkgConfig::ZMQ)
target_link_libraries(${CTP_TARGET_NAME} ${CTP_TRADER_LIB} ${CTP_MD_LIB} PkgConfig::ZMQ Iconv::Iconv)

# 将user_info.txt拷贝至build目录下(main_linux所在目录)；在build目录下建立 mdflow 和 traderflow 文件夹 存放 .con 文件
# add_custom_command(TARGET main_linux POST_BUILD
# COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_SOURCE_DIR}/${PROJECT_NAME}/user_info.txt ${CMAKE_BINARY_DIR}
# COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_BINARY_DIR}/mdflow
# COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_BINARY_DIR}/traderflow)
