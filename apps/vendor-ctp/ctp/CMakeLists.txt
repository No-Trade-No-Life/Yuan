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
    set(CMAKE_BUILD_RPATH "\$ORIGIN/../lib-demo")
    find_library(CTP_LIB NAMES thosttraderapi_se thostmduserapi_se PATHS ${PROJECT_SOURCE_DIR}/lib-demo) 
    message(STATUS "CTP_LIB: ${CTP_LIB}")

    # 获取 CTP 库的目录路径
    get_filename_component(CTP_LIB_DIR ${CTP_LIB} DIRECTORY)
    # 设置构建时 RPATH 包含 CTP 库目录
    set(CMAKE_BUILD_RPATH "${CMAKE_BUILD_RPATH}:\$ORIGIN/../${CTP_LIB_DIR}")
else()
    set(CMAKE_BUILD_RPATH "\$ORIGIN/../lib")
    find_library(CTP_LIB NAMES thosttraderapi_se thostmduserapi_se PATHS ${PROJECT_SOURCE_DIR}/lib) 
    message(STATUS "CTP_LIB: ${CTP_LIB}")

    # 获取 CTP 库的目录路径
    get_filename_component(CTP_LIB_DIR ${CTP_LIB} DIRECTORY)
    # 设置构建时 RPATH 包含 CTP 库目录
    set(CMAKE_BUILD_RPATH "${CMAKE_BUILD_RPATH}:\$ORIGIN/../${CTP_LIB_DIR}")
endif()
# 源文件列表存储进SRC变量
aux_source_directory(${PROJECT_SOURCE_DIR}/src SRC)
# 生成可执行文件
add_executable(main_linux ${SRC})
# 链接动态库
# target_include_directories(main_linux PRIVATE PkgConfig::ZMQ)
target_link_libraries(main_linux ${CTP_LIB} PkgConfig::ZMQ Iconv::Iconv)
# 将user_info.txt拷贝至build目录下(main_linux所在目录)；在build目录下建立 mdflow 和 traderflow 文件夹 存放 .con 文件
# add_custom_command(TARGET main_linux POST_BUILD
# COMMAND ${CMAKE_COMMAND} -E copy ${CMAKE_CURRENT_SOURCE_DIR}/${PROJECT_NAME}/user_info.txt ${CMAKE_BINARY_DIR}
# COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_BINARY_DIR}/mdflow
# COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_BINARY_DIR}/traderflow)