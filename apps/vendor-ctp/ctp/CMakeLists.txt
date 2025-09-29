cmake_minimum_required(VERSION 3.0.0)
project(ctp)
set(CMAKE_CXX_STANDARD 11)
# set(CMAKE_BUILD_TYPE Debug)

find_package(Iconv REQUIRED)
find_package(PkgConfig REQUIRED)

pkg_check_modules(ZMQ REQUIRED IMPORTED_TARGET libzmq)

option(USE_DEMO_LIBS "whether to use demo libs AKA openctp" OFF)

# 头文件目录
include_directories(${PROJECT_SOURCE_DIR}/include)

# 设置rpath
set(CMAKE_SKIP_BUILD_RPATH FALSE)
set(CMAKE_BUILD_WITH_INSTALL_RPATH FALSE)

# 库文件目录
if (USE_DEMO_LIBS)
    set(CTP_LIB_ROOT ${PROJECT_SOURCE_DIR}/lib-demo)
    set(CMAKE_BUILD_RPATH "\$ORIGIN/../lib-demo")
else()
    set(CTP_LIB_ROOT ${PROJECT_SOURCE_DIR}/lib)
    set(CMAKE_BUILD_RPATH "\$ORIGIN/../lib")
endif()

find_library(CTP_TRADER_LIB NAMES thosttraderapi_se thosttraderapi PATHS ${CTP_LIB_ROOT})
find_library(CTP_MD_LIB NAMES thostmduserapi_se thostmduserapi PATHS ${CTP_LIB_ROOT})

message(STATUS "CTP_TRADER_LIB: ${CTP_TRADER_LIB}")
message(STATUS "CTP_MD_LIB: ${CTP_MD_LIB}")

# 获取 CTP 库的目录路径并加入 RPATH
if (CTP_TRADER_LIB)
    get_filename_component(CTP_TRADER_LIB_DIR ${CTP_TRADER_LIB} DIRECTORY)
    set(CMAKE_BUILD_RPATH "${CMAKE_BUILD_RPATH}:\$ORIGIN/../${CTP_TRADER_LIB_DIR}")
endif()

if (CTP_MD_LIB)
    get_filename_component(CTP_MD_LIB_DIR ${CTP_MD_LIB} DIRECTORY)
    if (NOT CTP_MD_LIB_DIR STREQUAL CTP_TRADER_LIB_DIR)
        set(CMAKE_BUILD_RPATH "${CMAKE_BUILD_RPATH}:\$ORIGIN/../${CTP_MD_LIB_DIR}")
    endif()
endif()
# 源文件列表存储进SRC变量
aux_source_directory(${PROJECT_SOURCE_DIR}/src SRC)
# 生成可执行文件
add_executable(main_linux ${SRC})
# 链接动态库
# target_include_directories(main_linux PRIVATE PkgConfig::ZMQ)
target_link_libraries(main_linux ${CTP_TRADER_LIB} ${CTP_MD_LIB} PkgConfig::ZMQ Iconv::Iconv)
# 将user_info.txt拷贝至build目录下(main_linux所在目录)；在build目录下建立 mdflow 和 traderflow 文件夹 存放 .con 文件
# add_custom_command(TARGET main_linux POST_BUILD
# COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_SOURCE_DIR}/${PROJECT_NAME}/user_info.txt ${CMAKE_BINARY_DIR}
# COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_BINARY_DIR}/mdflow
# COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_BINARY_DIR}/traderflow)
